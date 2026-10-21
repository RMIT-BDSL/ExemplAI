import { convexQuery } from "@convex-dev/react-query";
import { usePostHog } from "@posthog/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery as useConvexQuery } from "convex/react";
import { ArrowRight, Loader2, Lock, MessageSquare, Play, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import AttemptBlock, { type Version } from "#/components/solve/AttemptBlock";
import type { NotebookBlock, NotebookHandle } from "#/components/solve/NotebookEditor";
import ThreadBlock, { DraftThread } from "#/components/solve/ThreadBlock";
import LessonIndex from "#/components/student/LessonIndex";
import LessonSkeleton from "#/components/student/LessonSkeleton";
import type { Message } from "#/components/student/problem/ChatBox";
import Problem, { formatCall } from "#/components/student/problem/Problem";
import { useTutorChat } from "#/components/student/problem/useTutorChat";
import StatusBar from "#/components/student/StatusBar";
import { codeStorageKey, readTabCopy, withStarterHint } from "#/components/student/lessonCode";
import { authClient } from "#/lib/auth-client";
import { useLessonVisit } from "#/lib/useLessonVisit";
import { cn } from "#/lib/utils.ts";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// Monaco is several hundred KB: keep it out of the route chunk.
const NotebookEditor = lazy(() => import("#/components/solve/NotebookEditor"));
// NotebookEditor's END, repeated so the route chunk doesn't pull in Monaco.
const END = -1;

// Solve: an alternative lesson workspace shaped like a notebook that is still
// one file. The student's code is a single document; the problem sits above
// it, and every Run/Submit (frozen as a version) and every tutor thread sits
// between its lines, at the place it was about. Run/Submit grade exactly as
// on /course and the server logs each one in codeAttempts, which is where the
// versions come from; the tutor follows the course chat's rules (useTutorChat).
// Lesson locks, autosaved drafts and time on task work as on /course.
export const Route = createFileRoute("/_authenticated/solve")({
  component: Solve,
  validateSearch: (search: Record<string, unknown>) => ({
    problemId: (search.problemId as string) || undefined,
  }),
  loaderDeps: ({ search: { problemId } }) => ({ problemId }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(convexQuery(api.courses.getAllCourses, {}));
    void context.queryClient.prefetchQuery(
      convexQuery(api.courses.getQuestionById, deps.problemId ? { id: deps.problemId } : "skip"),
    );
  },
});

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/** A Run/Submit in flight: its block shows until the server's row arrives. */
interface Pending {
  kind: "run" | "submit";
  /** How many versions there were when it was sent. */
  before: number;
  /** The server has answered; the row is being saved. */
  answered: boolean;
}

/** A question being written at a line (`sending` once it has been sent). */
interface Draft {
  anchor: number;
  about: string;
  sending: string | null;
}

const OUTLINE_BUTTON =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-[2px] border border-rule-strong px-3 text-[11px] font-medium tracking-[0.02em] text-brass transition-colors hover:bg-surface-raised disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";
const FILLED_BUTTON =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-[2px] border border-brass-fill bg-brass-fill px-3 text-[11px] font-semibold tracking-[0.02em] text-on-brass transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

function lastCodeLine(code: string) {
  const lines = code.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim()) return i + 1;
  return 1;
}

function Solve() {
  const { problemId } = Route.useSearch();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { resolvedTheme } = useTheme();
  const editorTheme = resolvedTheme === "dark" ? "exemplaiDark" : "exemplaiLight";

  const { data: questions } = useQuery(convexQuery(api.courses.getAllCourses, {}));
  const { data: fetchedQuestion } = useQuery(
    convexQuery(api.courses.getQuestionById, problemId ? { id: problemId } : "skip"),
  );
  const { data: session } = authClient.useSession();
  const signedIn = !!session?.user?.id;
  const { data: lessonProgress } = useQuery(
    convexQuery(api.courses.getLessonProgress, signedIn ? {} : "skip"),
  );
  // Lessons unlock one at a time within each week; null = no locks.
  const { data: unlocked } = useQuery(
    convexQuery(api.lessonAccess.getUnlockedLessons, signedIn ? {} : "skip"),
  );
  const setLessonStatus = useMutation(api.courses.setLessonStatus);
  const openLesson = useMutation(api.examples.openLesson);
  const saveCodeDraft = useMutation(api.codeDrafts.save);

  const activeQuestion = problemId
    ? fetchedQuestion
    : questions === undefined
      ? undefined
      : (questions[0] ?? null);
  const lessonId = activeQuestion?._id as Id<"questions"> | undefined;
  const unlockedSet = unlocked ? new Set<string>(unlocked) : unlocked;
  const isLocked = !!lessonId && !!unlockedSet && !unlockedSet.has(lessonId);
  const canOpen = signedIn && unlocked !== undefined && !isLocked;
  const attempts: Version[] | undefined = useConvexQuery(
    api.codeAttempts.listMine,
    lessonId && canOpen ? { lessonId } : "skip",
  );
  const codeDraft = useConvexQuery(api.codeDrafts.get, lessonId && canOpen ? { lessonId } : "skip");

  const editorRef = useRef<any>(null);
  const notebookRef = useRef<NotebookHandle | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isIndexOpen, setIsIndexOpen] = useState(false);

  // Threads: which thread each student turn belongs to (a thread is named by
  // its first turn) and the line each thread was opened at. This visit only,
  // like the chat itself.
  const [threadOf, setThreadOf] = useState<Record<string, string>>({});
  const [threadAnchor, setThreadAnchor] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  // A turn has been sent but Convex hasn't given its id yet: hold it back so
  // it doesn't flash up as a thread of its own.
  const [awaitingSave, setAwaitingSave] = useState(false);

  const chat = useTutorChat({
    editorRef,
    currentCode: code,
    lessonId,
    onExampleRequested: (trigger, examplesUsed) =>
      posthog.capture(trigger === "get_help" ? "get_help_clicked" : "new_example_clicked", {
        problem_id: lessonId,
        examples_used: examplesUsed,
        workspace: "solve",
      }),
  });

  useEffect(() => {
    if (canOpen && lessonId) {
      setLessonStatus({ lessonId, status: "in-progress" }).catch(() => {});
      // Coming back from another lesson resets a used-up example allowance.
      openLesson({ lessonId }).catch(() => {});
    }
  }, [canOpen, lessonId, setLessonStatus, openLesson]);

  // Time on task: a visit per lesson opening, with active time (research log).
  useLessonVisit(canOpen ? lessonId : undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new lesson starts clean
  useEffect(() => {
    setRunError(null);
    setPending(null);
    setDraft(null);
    setThreadOf({});
    setThreadAnchor({});
  }, [lessonId]);

  // The version being run is in once the server's row has arrived.
  useEffect(() => {
    if (pending && (attempts?.length ?? 0) > pending.before) setPending(null);
  }, [pending, attempts]);
  // In case the row never comes (e.g. the server couldn't reach Convex).
  useEffect(() => {
    if (!pending?.answered) return;
    const timer = setTimeout(() => setPending(null), 15_000);
    return () => clearTimeout(timer);
  }, [pending]);

  // The document starts from the newer of the tab's copy and the server's
  // draft (both shared with /course), else the latest version, else the
  // starter code. Decided once per lesson; the editor is keyed by lesson.
  const draftKey = lessonId ? codeStorageKey(lessonId, "python") : null;
  const [initial, setInitial] = useState<{ key: string; code: string } | null>(null);
  const initialCode = initial && initial.key === draftKey ? initial.code : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per lesson, when its draft and versions have arrived
  useEffect(() => {
    if (!activeQuestion || !draftKey || initialCode !== null) return;
    if (!canOpen || codeDraft === undefined || attempts === undefined) return;
    const tab = readTabCopy(draftKey);
    const server = codeDraft ?? null;
    const saved =
      tab && server ? (server.updated_at > tab.at ? server.code : tab.code) : (tab?.code ?? server?.code ?? null);
    const start = saved ?? attempts.at(-1)?.code ?? withStarterHint(activeQuestion.starter_code ?? "");
    setInitial({ key: draftKey, code: start });
    setCode(start);
  }, [draftKey, initialCode, canOpen, codeDraft, attempts]);

  // Autosave as on /course: to the tab and the server shortly after typing
  // stops, and flushed on lesson change, unmount and when the page is hidden.
  const pendingSaveRef = useRef<{ key: string; lessonId: Id<"questions">; code: string } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flushSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const save = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!save) return;
    try {
      sessionStorage.setItem(save.key, JSON.stringify({ code: save.code, at: Date.now() }));
    } catch {}
    saveCodeDraft({ lessonId: save.lessonId, code: save.code }).catch(() => {});
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: flushSave only touches refs
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flushSave();
    window.addEventListener("pagehide", flushSave);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushSave);
      document.removeEventListener("visibilitychange", onHide);
      flushSave();
    };
  }, [lessonId]);

  // The chat's turns grouped into threads, in the order they were opened.
  const threads = useMemo(() => {
    const list: { id: string; messages: Message[] }[] = [];
    const byId = new Map<string, (typeof list)[number]>();
    let current: (typeof list)[number] | undefined;
    for (const m of chat.messages) {
      if (m.sender === "user") {
        if (awaitingSave && !(m.id in threadOf)) break;
        const id = threadOf[m.id] ?? m.id;
        current = byId.get(id);
        if (!current) {
          current = { id, messages: [] };
          byId.set(id, current);
          list.push(current);
        }
      } else if (!current) {
        current = { id: m.id, messages: [] };
        byId.set(m.id, current);
        list.push(current);
      }
      current.messages.push(m);
    }
    return { list, active: current };
  }, [chat.messages, threadOf, awaitingSave]);

  const runShortcutRef = useRef<() => void>(() => {});
  const askShortcutRef = useRef<() => void>(() => {});

  if (activeQuestion === undefined) return <LessonSkeleton />;
  if (activeQuestion === null) {
    return (
      <div className="xa-workspace flex h-dvh w-screen items-center justify-center bg-surface-page text-ink-label">
        No questions found.
      </div>
    );
  }

  const exampleIndex = (activeQuestion.testCases ?? []).findIndex((tc: any) => !tc.hidden);
  const example = exampleIndex >= 0 ? activeQuestion.testCases?.[exampleIndex] : undefined;
  const functionName =
    /def\s+(\w+)\s*\(/.exec(activeQuestion.starter_code ?? "")?.[1] ?? activeQuestion.problem_name;
  const problem = {
    id: activeQuestion._id,
    title: activeQuestion.problem_name,
    description: activeQuestion.problem_description,
    functionName,
    example: example ? { input: example.input, expectedOutput: example.expectedOutput } : undefined,
  };

  const latest = attempts?.at(-1);
  const edited = !latest || latest.code !== code;
  const nextVersion = (attempts?.length ?? 0) + 1;
  const currentIndex = questions?.findIndex((q: any) => q._id === lessonId) ?? -1;
  const previousQuestion =
    currentIndex > 0 && questions?.[currentIndex - 1]?.week === activeQuestion.week
      ? questions[currentIndex - 1]
      : null;
  const nextQuestion = questions && currentIndex >= 0 ? questions[currentIndex + 1] : undefined;
  // A passing Submit of exactly this code turns Submit into Next lesson.
  const passed = !edited && latest?.kind === "submit" && latest.outcome === "passed";
  const call = example ? formatCall(functionName, example.input) : undefined;

  function handleChange(value: string) {
    setCode(value);
    if (!lessonId || !draftKey || initialCode === null) return;
    pendingSaveRef.current = { key: draftKey, lessonId, code: value };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, 800);
  }

  async function execute(kind: "run" | "submit") {
    if (pending || !lessonId) return;
    const source: string = editorRef.current?.getValue() ?? code;
    setPending({ kind, before: attempts?.length ?? 0, answered: false });
    setRunError(null);
    try {
      const { default: axios } = await import("axios");
      const token = (await authClient.convex.token()).data?.token;
      const { data } = await axios.post(
        `${BACKEND_URL}/execute`,
        {
          code: source,
          language_id: 71, // Python 3 (Judge0)
          starter_code: activeQuestion?.starter_code,
          solution_code: activeQuestion?.solution_code,
          // Run calls the function once on the example; Submit grades every test.
          test_cases: kind === "run" ? (example ? [example] : []) : (activeQuestion?.testCases ?? []),
          lesson_id: lessonId,
          action_type: kind,
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      // The server saves the version (codeAttempts) just after answering.
      setPending((p) => p && { ...p, answered: true });
      posthog.capture(kind === "run" ? "code_run" : "code_submitted", {
        problem_id: lessonId,
        success: !data?.error,
        workspace: "solve",
      });
    } catch (error: any) {
      posthog.captureException(error);
      setRunError(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          `Couldn't reach the code runner (${error.message || "request failed"}). Try again in a moment.`,
      );
      setPending(null);
    }
  }

  // Ask about the selected lines, or the cursor's line (Ctrl/⌘+I or the Ask button).
  function openAsk() {
    if (!chat.helpStarted || chat.isTyping || draft) return;
    const editor = editorRef.current;
    const selection = editor?.getSelection();
    const line = selection?.endLineNumber ?? editor?.getPosition()?.lineNumber ?? END;
    const about =
      selection && !selection.isEmpty() && selection.startLineNumber !== selection.endLineNumber
        ? `lines ${selection.startLineNumber}–${selection.endLineNumber}`
        : `line ${line}`;
    setDraft({ anchor: line, about, sending: null });
  }

  // Send a turn: into `threadId`, or as a new thread at the draft's line.
  function send(text: string, threadId?: string, trigger?: "get_help" | "new_example") {
    setAwaitingSave(true);
    const onSaved = (messageId: string) => {
      const thread = threadId ?? messageId;
      setThreadOf((prev) => ({ ...prev, [messageId]: thread }));
      if (!threadId) {
        const line = notebookRef.current?.lineOf("draft") ?? END;
        setThreadAnchor((prev) => ({ ...prev, [thread]: line }));
        setDraft(null);
      }
      setAwaitingSave(false);
    };
    const done = () => {
      setAwaitingSave(false);
      // Never saved (e.g. the chat refused it): let the student try again.
      setDraft((d) => (d?.sending ? { ...d, sending: null } : d));
    };
    if (trigger) {
      const request = chat.requestExample(trigger, onSaved);
      if (request) request.finally(done);
      else done();
      return;
    }
    chat.sendMessage(text, undefined, onSaved).finally(done);
  }

  function getHelp() {
    setDraft({ anchor: END, about: "your code", sending: "Asking for an example…" });
    send("", undefined, chat.exampleTrigger);
  }

  runShortcutRef.current = () => execute("run");
  askShortcutRef.current = openAsk;

  function handleEditorMount(editor: any, monaco: any) {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runShortcutRef.current());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => askShortcutRef.current());
  }

  const blocks: NotebookBlock[] = [
    {
      id: "problem",
      anchor: 0,
      content: (
        <div className="editorial-prose mb-3 rounded-[4px] border border-rule-strong bg-surface-panel px-6 py-5">
          <Problem problem={problem} />
          <p className="mt-4 font-sans text-[11px] text-ink-label">
            Runs and Submits are saved in the code as versions you can't change. Select lines and press
            Ctrl+I to ask the tutor about them.{" "}
            <Link to="/course" search={{ problemId: lessonId }} className="text-brass hover:underline">
              Classic workspace
            </Link>
          </p>
        </div>
      ),
    },
    ...(attempts ?? []).map((attempt, i) => ({
      id: attempt._id,
      // Under the last line of the code that ran.
      anchor: lastCodeLine(attempt.code),
      content: (
        <div className="py-1.5">
          <AttemptBlock
            attempt={attempt}
            version={i + 1}
            call={call}
            previousCode={attempts?.[i - 1]?.code}
            defaultOpen={i === (attempts?.length ?? 0) - 1}
            onRestore={(c) => notebookRef.current?.replaceCode(c)}
          />
        </div>
      ),
    })),
    ...threads.list.map((thread, i) => {
      const isActive = thread === threads.active;
      return {
        id: `thread-${thread.id}`,
        anchor: threadAnchor[thread.id] ?? END,
        content: (
          <div className="py-1.5">
            <ThreadBlock
              messages={thread.messages}
              notice={i === 0}
              progress={isActive && chat.isTyping && !awaitingSave ? chat.progress : null}
              reply={
                isActive && chat.helpStarted && !chat.isTyping && !draft
                  ? {
                      disabled: !chat.ready,
                      placeholder: "Reply…",
                      onSend: (text) => send(text, thread.id),
                    }
                  : null
              }
            />
          </div>
        ),
      };
    }),
  ];
  if (draft) {
    blocks.push({
      id: "draft",
      anchor: draft.anchor,
      content: (
        <div className="py-1.5">
          <DraftThread
            about={draft.about}
            sending={draft.sending}
            disabled={!chat.ready}
            onSend={(text) => {
              setDraft((d) => d && { ...d, sending: "Sending…" });
              send(text);
            }}
            onCancel={() => {
              setDraft(null);
              editorRef.current?.focus();
            }}
          />
        </div>
      ),
    });
  }
  if (pending) {
    blocks.push({
      id: "pending",
      anchor: END,
      content: (
        <div className="py-1.5">
          <div className="flex h-7 items-center gap-2 rounded-[4px] border border-dashed border-rule-strong px-2 font-sans text-[10px] uppercase tracking-[0.15em] text-ink-label">
            <Loader2 className="size-3 animate-spin text-brass" />v{nextVersion} ·{" "}
            {pending.answered ? "Saving" : pending.kind === "run" ? "Running" : "Submitting"}…
          </div>
        </div>
      ),
    });
  }
  if (runError) {
    blocks.push({
      id: `run-error-${runError}`,
      anchor: END,
      content: (
        <div className="py-1.5">
          <p className="rounded-[4px] border border-danger/40 bg-surface-panel px-3 py-2 font-sans text-xs text-danger">
            {runError}
          </p>
        </div>
      ),
    });
  }

  // Get help until help starts; then Ask and the ✦ Example button (same rules as the course chat).
  const showGetHelp = !chat.helpStarted && !chat.isTyping && (chat.canGetHelp || chat.canNewExample);

  return (
    <div className="xa-workspace flex h-dvh w-full flex-col overflow-hidden bg-surface-page text-ink antialiased">
      <StatusBar
        week={activeQuestion.week}
        topic={activeQuestion.topic}
        isIndexOpen={isIndexOpen}
        onOpenIndex={() => setIsIndexOpen(true)}
      />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <LessonIndex
          isIndexOpen={isIndexOpen}
          setIsIndexOpen={setIsIndexOpen}
          questions={questions}
          activeQuestionId={lessonId}
          lessonProgress={lessonProgress}
          unlocked={unlockedSet}
          onSelectLesson={() => {}}
          lessonPath="/solve"
        />

        {isLocked ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <Lock className="size-5 text-ink-label" aria-hidden="true" />
            <p className="font-serif text-[1.1rem] text-ink">{activeQuestion.problem_name} is locked</p>
            <p className="max-w-sm text-[12px] leading-relaxed text-ink-label">
              {previousQuestion ? (
                <>
                  It unlocks when you pass{" "}
                  <Link
                    to="/solve"
                    search={{ problemId: previousQuestion._id }}
                    className="text-brass underline underline-offset-2"
                  >
                    {previousQuestion.problem_name}
                  </Link>
                  , or after three tries at it.
                </>
              ) : (
                "It unlocks when you pass the exercise before it, or after three tries at it."
              )}
            </p>
          </div>
        ) : (

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden border-x border-rule-strong bg-surface-editor">
          <div className="min-h-0 flex-1">
            {initialCode === null ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-5 animate-spin text-brass" />
              </div>
            ) : (
              <Suspense fallback={<div className="h-full" />}>
                <NotebookEditor
                  key={lessonId}
                  theme={editorTheme}
                  defaultValue={initialCode}
                  onChange={handleChange}
                  onMount={handleEditorMount}
                  blocks={blocks}
                  handleRef={notebookRef}
                />
              </Suspense>
            )}
          </div>

          {/* Footer: the course editor's bar, with the tutor's controls on the left. */}
          <div className="flex h-[52px] flex-shrink-0 items-center gap-2 border-t border-rule-strong bg-surface-void px-4 select-none">
            {showGetHelp ? (
              <button
                type="button"
                onClick={getHelp}
                disabled={!chat.exampleEnabled || !!draft}
                className={FILLED_BUTTON}
              >
                <Sparkles className="size-3.5" />
                Get help
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openAsk}
                  disabled={!chat.helpStarted || chat.isTyping || !!draft}
                  title={
                    chat.helpStarted
                      ? "Ask about the selected lines (Ctrl+I, or ⌘+I on Mac)"
                      : (chat.exampleStatus ?? undefined)
                  }
                  aria-keyshortcuts="Control+I Meta+I"
                  className={OUTLINE_BUTTON}
                >
                  <MessageSquare className="size-3.5" />
                  Ask
                </button>
                {chat.helpStarted && !chat.isControl && (
                  <button
                    type="button"
                    onClick={getHelp}
                    disabled={!chat.exampleEnabled || chat.exhausted || chat.isTyping || !!draft}
                    title={chat.exampleStatus ?? "New example"}
                    className={OUTLINE_BUTTON}
                  >
                    <Sparkles className="size-3.5" />
                    Example
                  </button>
                )}
              </>
            )}
            <span
              className={cn(
                "ml-2 hidden min-w-0 truncate text-[10px] uppercase tracking-[0.15em] sm:block",
                edited ? "text-ink-label" : "text-ink-faint",
              )}
            >
              {edited ? `v${nextVersion} · not run yet` : `v${nextVersion - 1} · saved`}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => execute("run")}
                disabled={!!pending}
                title="Run (Ctrl+Enter, or ⌘+Enter on Mac)"
                aria-keyshortcuts="Control+Enter Meta+Enter"
                className={OUTLINE_BUTTON}
              >
                {pending?.kind === "run" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3 fill-current" />
                )}
                Run
              </button>
              {passed && nextQuestion ? (
                <button
                  type="button"
                  onClick={() => navigate({ to: "/solve", search: { problemId: nextQuestion._id } })}
                  className={FILLED_BUTTON}
                >
                  Next lesson
                  <ArrowRight className="size-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => execute("submit")}
                  disabled={!!pending}
                  className={FILLED_BUTTON}
                >
                  {pending?.kind === "submit" && <Loader2 className="size-3.5 animate-spin" />}
                  Submit
                </button>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
