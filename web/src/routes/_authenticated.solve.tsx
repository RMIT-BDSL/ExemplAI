import { convexQuery } from "@convex-dev/react-query";
import { usePostHog } from "@posthog/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery as useConvexQuery } from "convex/react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Flag,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { RunOutputBlock, SubmitBlock, TutorOutputBlock } from "#/components/solve/CellOutputs";
import { type FoldAll, useFold } from "#/components/solve/fold";
import type { CellEditorHandle } from "#/components/solve/MarkdownCellEditor";
import NotebookCell, { InsertBar } from "#/components/solve/NotebookCell";
import {
  afterReload,
  type Cell,
  type CellType,
  gradedProgram,
  latestSolution,
  newCellId,
  programOf,
  type RunOutput,
  type SubmitOutput,
  type TutorOutput,
  solutionSeed,
} from "#/components/solve/notebook";
import { codeStorageKey, readTabCopy, withStarterHint } from "#/components/student/lessonCode";
import LessonIndex from "#/components/student/LessonIndex";
import LessonSkeleton from "#/components/student/LessonSkeleton";
import Problem, { formatCall, type ProblemData } from "#/components/student/problem/Problem";
import { GET_HELP_MESSAGE, NEW_EXAMPLE_MESSAGE, useTutorChat } from "#/components/student/problem/useTutorChat";
import StatusBar from "#/components/student/StatusBar";
import { authClient } from "#/lib/auth-client";
import { useLessonVisit } from "#/lib/useLessonVisit";
import { cn } from "#/lib/utils.ts";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// Solve: an alternative lesson workspace shaped like a notebook. The student
// works in cells, each either code or markdown, and moves between them as in
// Jupyter or SolveIt. Running a code cell runs it with the code cells above
// it; "running" a markdown cell asks the tutor about it, and the reply shows
// under it. Submit grades all the code cells together, exactly as /course
// grades its one file. Every Run and Submit is still logged by the server in
// codeAttempts, and every question in chatMessages; the notebook itself (cells
// and their last outputs) is the student's working copy, saved in
// solveNotebooks. Lesson locks, the tutor's rules (useTutorChat) and time on
// task work as on /course.
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

const OUTLINE_BUTTON =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-[2px] border border-rule-strong px-3 text-[11px] font-medium tracking-[0.02em] text-brass transition-colors hover:bg-surface-raised disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";
const FILLED_BUTTON =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-[2px] border border-brass-fill bg-brass-fill px-3 text-[11px] font-semibold tracking-[0.02em] text-on-brass transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

/**
 * The problem above the cells. It stays at the top while the cells scroll
 * under it (a long one scrolls inside its own box), and folds to its title.
 */
function ProblemBlock({ problem, lessonId, foldAll }: { problem: ProblemData; lessonId: string; foldAll: FoldAll }) {
  const [open, setOpen] = useFold(true, foldAll);
  return (
    // The strip around the box hides cells passing underneath it.
    <div className="sticky top-0 z-30 -mt-4 bg-surface-editor px-4 pt-4 pb-3">
      <div className="rounded-[4px] border border-rule-strong bg-surface-panel shadow-sm">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex h-8 w-full items-center gap-2 px-3 text-left font-sans text-[10px] select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-brass"
        >
          {open ? <ChevronDown className="size-3 text-ink-label" /> : <ChevronRight className="size-3 text-ink-label" />}
          <span className="font-semibold uppercase tracking-[0.15em] text-brass">Problem</span>
          {!open && <span className="min-w-0 truncate text-[11px] text-ink-muted">{problem.title}</span>}
        </button>
        {open && (
          <div className="editorial-prose editorial-scroll max-h-[40vh] overflow-y-auto border-t border-rule px-6 pt-4 pb-5">
            <Problem problem={problem} />
            <p className="mt-4 font-sans text-[11px] leading-relaxed text-ink-label">
              Work in cells: code, or markdown for notes and questions. Ctrl/⌘+Enter runs a code cell (after the code
              cells above it) or asks the tutor about a markdown cell; Shift+Enter does the same and moves on; Ctrl/⌘+M
              switches a cell between code and markdown. New solution adds a solution cell that starts from your last
              one; Submit grades your newest solution cell on its own (all your code cells together while you have
              none), and solution cells are kept as a record of your tries.{" "}
              <Link to="/course" search={{ problemId: lessonId }} className="text-brass hover:underline">
                Classic workspace
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
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
  const saveNotebook = useMutation(api.solveNotebooks.save);

  const activeQuestion = problemId
    ? fetchedQuestion
    : questions === undefined
      ? undefined
      : (questions[0] ?? null);
  const lessonId = activeQuestion?._id as Id<"questions"> | undefined;
  const unlockedSet = unlocked ? new Set<string>(unlocked) : unlocked;
  const isLocked = !!lessonId && !!unlockedSet && !unlockedSet.has(lessonId);
  const canOpen = signedIn && unlocked !== undefined && !isLocked;
  const savedNotebook = useConvexQuery(api.solveNotebooks.get, lessonId && canOpen ? { lessonId } : "skip");
  // Only needed to start a first notebook from the student's /course code.
  const codeDraft = useConvexQuery(
    api.codeDrafts.get,
    lessonId && canOpen && savedNotebook === null ? { lessonId } : "skip",
  );

  // The notebook, once loaded for this lesson.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [submit, setSubmit] = useState<SubmitOutput | null>(null);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [foldAll, setFoldAll] = useState<FoldAll>({ open: true, n: 0 });
  const handles = useRef(new Map<string, CellEditorHandle>());

  const chat = useTutorChat({
    lessonId,
    // The tutor sees the notebook's program, as /course sends its file.
    getEditorContext: () => {
      const code = programOf(cellsRef.current);
      return code ? `Code:\n${code}\n` : "";
    },
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

  // Load each lesson's notebook once: the saved one, else a first code cell
  // with the newer of the tab's and the server's /course code, else the starter.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per lesson, when its notebook has arrived
  useEffect(() => {
    if (!activeQuestion || !lessonId || loadedFor === lessonId || !canOpen) return;
    if (savedNotebook === undefined || (savedNotebook === null && codeDraft === undefined)) return;
    if (savedNotebook) {
      setCells(afterReload(savedNotebook.cells as Cell[]));
      setSubmit((savedNotebook.submit as SubmitOutput | null) ?? null);
    } else {
      const tab = readTabCopy(codeStorageKey(lessonId, "python"));
      const server = codeDraft ?? null;
      const saved =
        tab && server ? (server.updated_at > tab.at ? server.code : tab.code) : (tab?.code ?? server?.code ?? null);
      const id = newCellId();
      setCells([{ id, type: "code", source: saved ?? withStarterHint(activeQuestion.starter_code ?? "") }]);
      setSubmit(null);
      setAutoFocusId(id);
    }
    setFocusedId(null);
    setRunningId(null);
    setLoadedFor(lessonId);
  }, [lessonId, loadedFor, canOpen, savedNotebook, codeDraft]);
  const loaded = !!lessonId && loadedFor === lessonId;

  // Autosave, as /course saves its code: shortly after a change, and flushed
  // on lesson change, unmount and when the page is hidden.
  const pendingSaveRef = useRef<{ lessonId: Id<"questions">; cells: Cell[]; submit: SubmitOutput | null } | null>(
    null,
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flushSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const save = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!save) return;
    saveNotebook({ lessonId: save.lessonId, cells: save.cells, ...(save.submit ? { submit: save.submit } : {}) }).catch(
      () => {},
    );
  }
  const firstLoadRef = useRef<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: save whenever the notebook changes
  useEffect(() => {
    if (!loaded || !lessonId) return;
    // Loading isn't an edit.
    if (firstLoadRef.current !== lessonId) {
      firstLoadRef.current = lessonId;
      return;
    }
    pendingSaveRef.current = { lessonId, cells, submit };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, 800);
  }, [cells, submit, loaded]);
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

  // A question's reply lands in the chat (saved there by the server): copy it
  // to its cell. A failed send says why.
  useEffect(() => {
    const waiting = cells.filter((c) => c.output?.kind === "tutor" && c.output.status === "waiting");
    if (!waiting.length) return;
    const messages = chat.messages;
    const error = messages.find((m) => m.id === "local-error");
    let changed = false;
    const next = cells.map((cell) => {
      const out = cell.output;
      if (out?.kind !== "tutor" || out.status !== "waiting") return cell;
      const at = out.message_id ? messages.findIndex((m) => m.id === out.message_id) : -1;
      const reply = at >= 0 ? messages.slice(at + 1).find((m) => m.sender === "assistant" && m.id !== "local-error") : null;
      if (reply) {
        changed = true;
        return {
          ...cell,
          output: { ...out, status: "done" as const, reply: reply.content, reply_type: reply.responseType },
        };
      }
      if (!chat.isTyping && error) {
        changed = true;
        return { ...cell, output: { ...out, status: "error" as const, note: error.content } };
      }
      return cell;
    });
    if (changed) setCells(next);
  }, [chat.messages, chat.isTyping, cells]);

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
  const problem: ProblemData = {
    id: activeQuestion._id,
    title: activeQuestion.problem_name,
    description: activeQuestion.problem_description,
    functionName,
    example: example ? { input: example.input, expectedOutput: example.expectedOutput } : undefined,
  };
  const call = example ? formatCall(functionName, example.input) : undefined;
  const currentIndex = questions?.findIndex((q: any) => q._id === lessonId) ?? -1;
  const previousQuestion =
    currentIndex > 0 && questions?.[currentIndex - 1]?.week === activeQuestion.week
      ? questions[currentIndex - 1]
      : null;
  const nextQuestion = questions && currentIndex >= 0 ? questions[currentIndex + 1] : undefined;
  const program = gradedProgram(cells);
  const hasSolution = !!latestSolution(cells);
  // A passing Submit of exactly this code turns Submit into Next lesson.
  const passed = submit?.outcome === "passed" && submit.code === program;
  const firstTutorCell = cells.find((c) => c.output?.kind === "tutor")?.id;

  // ── Cell edits ──────────────────────────────────────────────────────────
  function updateCell(id: string, patch: Partial<Cell>) {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function insertCell(at: number, type: CellType, source = "") {
    const cell: Cell = { id: newCellId(), type, source };
    setCells((prev) => [...prev.slice(0, at), cell, ...prev.slice(at)]);
    setAutoFocusId(cell.id);
    return cell;
  }
  function moveCell(id: string, by: -1 | 1) {
    setCells((prev) => {
      const i = prev.findIndex((c) => c.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function deleteCell(id: string) {
    const i = cells.findIndex((c) => c.id === id);
    // Solution cells are the record of the student's tries: they stay.
    if (cells.length === 1 || i < 0 || cells[i].solution) return;
    setCells((prev) => prev.filter((c) => c.id !== id));
    const neighbour = cells[i + 1] ?? cells[i - 1];
    handles.current.get(neighbour.id)?.focus("start");
  }
  // The editor changes with the type; the text stays.
  function toggleType(id: string) {
    const cell = cells.find((c) => c.id === id);
    if (!cell || cell.solution) return;
    updateCell(id, { type: cell.type === "code" ? "markdown" : "code", output: undefined });
    setAutoFocusId(id);
  }
  function leave(id: string, direction: -1 | 1) {
    const i = cells.findIndex((c) => c.id === id);
    const target = cells[i + direction];
    if (target) handles.current.get(target.id)?.focus(direction === 1 ? "start" : "end");
  }
  // Shift+Enter: on to the next cell, or a new code cell at the end.
  function advance(id: string) {
    const i = cells.findIndex((c) => c.id === id);
    const target = cells[i + 1];
    if (target) handles.current.get(target.id)?.focus("start");
    else insertCell(cells.length, "code");
  }

  // A solution cell at the end, starting from the student's last solution
  // (else their last Submit, else the starter code).
  function newSolution() {
    const starter = withStarterHint(activeQuestion?.starter_code ?? "");
    const cell: Cell = { id: newCellId(), type: "code", source: solutionSeed(cells, submit, starter), solution: true };
    setCells((prev) => [...prev, cell]);
    setAutoFocusId(cell.id);
    posthog.capture("solution_cell_added", { problem_id: lessonId, workspace: "solve" });
  }

  // ── Run a code cell (with the code cells above it) ──────────────────────
  // A solution cell runs on its own, as Submit grades it.
  async function runCell(cell: Cell) {
    if (runningId || submitting || !lessonId) return;
    const source = cell.solution ? cell.source : programOf(cells, cell.id);
    const firstCode = cells.find((c) => c.type === "code")?.id === cell.id;
    const prev_source =
      cell.output?.kind === "run"
        ? cell.output.source
        : firstCode
          ? withStarterHint(activeQuestion?.starter_code ?? "")
          : undefined;
    setRunningId(cell.id);
    let output: RunOutput;
    try {
      const data = await execute("run", source);
      output = {
        kind: "run",
        at: Date.now(),
        source: cell.source,
        prev_source,
        call,
        stdout: data?.stdout || undefined,
        return_value: data?.return_value ?? undefined,
        error: data?.stderr || undefined,
      };
    } catch (error: any) {
      output = { kind: "run", at: Date.now(), source: cell.source, prev_source, error: runnerError(error) };
    } finally {
      setRunningId(null);
    }
    updateCell(cell.id, { output });
  }

  // ── Ask the tutor about a markdown cell ─────────────────────────────────
  function askCell(cell: Cell) {
    const question = cell.source.trim();
    if (!question || chat.isTyping) return;
    const at = Date.now();
    if (!chat.helpStarted) {
      const note =
        chat.canGetHelp || chat.canNewExample
          ? "The tutor opens with an example: press Get help below first."
          : (chat.exampleStatus ?? "The tutor isn't open yet.");
      updateCell(cell.id, { output: { kind: "tutor", at, question, status: "locked", note } });
      return;
    }
    sendToTutor(cell.id, question, (onSaved) => chat.sendMessage(question, undefined, onSaved));
  }

  /** Mark the cell as waiting, send, and remember the turn's id to find the reply. */
  function sendToTutor(
    cellId: string,
    question: string,
    send: (onSaved: (id: string) => void) => Promise<void> | null,
  ) {
    const waiting: TutorOutput = { kind: "tutor", at: Date.now(), question, status: "waiting" };
    updateCell(cellId, { output: waiting });
    const onSaved = (messageId: string) =>
      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId && c.output?.kind === "tutor" ? { ...c, output: { ...c.output, message_id: messageId } } : c,
        ),
      );
    const settle = () =>
      // Never saved (e.g. the chat refused it): say so instead of waiting forever.
      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId && c.output?.kind === "tutor" && c.output.status === "waiting" && !c.output.message_id
            ? { ...c, output: { ...c.output, status: "error", note: "Couldn't send this to the tutor. Try again." } }
            : c,
        ),
      );
    const request = send(onSaved);
    if (request) request.finally(settle);
    else settle();
  }

  // Get help / New example: the request goes in as a markdown cell at the end.
  function getHelp() {
    const trigger = chat.exampleTrigger;
    const text = trigger === "get_help" || !chat.helpStarted ? GET_HELP_MESSAGE : NEW_EXAMPLE_MESSAGE;
    const cell = insertCell(cells.length, "markdown", text);
    sendToTutor(cell.id, text, (onSaved) => chat.requestExample(trigger, onSaved));
  }

  // ── Run / Submit through the server, as /course does ────────────────────
  async function execute(kind: "run" | "submit", code: string) {
    const { default: axios } = await import("axios");
    const token = (await authClient.convex.token()).data?.token;
    const { data } = await axios.post(
      `${BACKEND_URL}/execute`,
      {
        code,
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
    posthog.capture(kind === "run" ? "code_run" : "code_submitted", {
      problem_id: lessonId,
      success: !data?.error,
      workspace: "solve",
    });
    return data;
  }

  function runnerError(error: any) {
    posthog.captureException(error);
    return (
      error.response?.data?.detail ||
      error.response?.data?.message ||
      `Couldn't reach the code runner (${error.message || "request failed"}). Try again in a moment.`
    );
  }

  async function submitNotebook() {
    if (runningId || submitting || !lessonId) return;
    const code = program;
    const base = { at: Date.now(), code, prev_code: submit?.code };
    setSubmitting(true);
    try {
      const data = await execute("submit", code);
      const results: any[] = data?.test_results ?? [];
      const passedCount = results.filter((r) => r.passed).length;
      // A syntax/runtime error shows its trace; else the first failed visible
      // test. Hidden tests are never shown.
      const codeError = data?.status?.id === 6 ? data?.stderr : results.find((r) => !r.hidden && r.stderr)?.stderr;
      const failed = results.find((r) => !r.hidden && !r.passed);
      const detail = failed
        ? `${formatCall(functionName, failed.input ?? "")}: expected ${failed.expected ?? "?"}, got ${(failed.stdout ?? "").trim() || "nothing"}`
        : undefined;
      setSubmit({
        ...base,
        passed: passedCount,
        total: results.length,
        outcome: results.length > 0 && passedCount === results.length ? "passed" : "failed",
        error: codeError || detail,
      });
    } catch (error: any) {
      setSubmit({ ...base, passed: 0, total: 0, outcome: "error", error: runnerError(error) });
    } finally {
      setSubmitting(false);
    }
  }

  // Get help until help starts; then the ✦ Example button (same rules as the course chat).
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
          <div className="flex w-full flex-1 flex-col overflow-hidden bg-surface-editor">
            <div className="editorial-scroll min-h-0 flex-1 overflow-y-auto py-4">
              <ProblemBlock problem={problem} lessonId={activeQuestion._id} foldAll={foldAll} />
              {!loaded ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-5 animate-spin text-brass" />
                </div>
              ) : (
                <>
                  {cells.map((cell, i) => {
                    const out = cell.output;
                    return (
                      <div key={cell.id}>
                        <InsertBar onInsert={(type) => insertCell(i, type)} />
                        <NotebookCell
                          cell={cell}
                          index={i + 1}
                          count={cells.length}
                          focused={focusedId === cell.id}
                          autoFocus={autoFocusId === cell.id}
                          theme={editorTheme}
                          busy={
                            cell.type === "code"
                              ? runningId === cell.id
                              : out?.kind === "tutor" && out.status === "waiting"
                          }
                          onChange={(source) => updateCell(cell.id, { source })}
                          onFocus={() => setFocusedId(cell.id)}
                          onMove={(by) => moveCell(cell.id, by)}
                          onDelete={() => deleteCell(cell.id)}
                          handleRef={(handle) => {
                            if (handle) handles.current.set(cell.id, handle);
                            else handles.current.delete(cell.id);
                          }}
                          onRun={(next) => {
                            if (cell.type === "code") runCell(cell);
                            else askCell(cell);
                            if (next) advance(cell.id);
                          }}
                          onToggleType={() => toggleType(cell.id)}
                          onLeave={(direction) => leave(cell.id, direction)}
                          onAsk={() => insertCell(i + 1, "markdown")}
                          output={
                            out?.kind === "run" ? (
                              <RunOutputBlock output={out} foldAll={foldAll} />
                            ) : out?.kind === "tutor" ? (
                              <TutorOutputBlock
                                output={out}
                                notice={cell.id === firstTutorCell}
                                progress={
                                  out.status === "waiting" && chat.isTyping
                                    ? { steps: chat.progress, forExample: chat.waitingForExample }
                                    : null
                                }
                                foldAll={foldAll}
                              />
                            ) : null
                          }
                        />
                      </div>
                    );
                  })}
                  <InsertBar onInsert={(type) => insertCell(cells.length, type)} />
                  <div className="mt-2 mr-4 ml-[3.75rem] pl-3">
                    <button
                      type="button"
                      onClick={newSolution}
                      title="Add a solution cell with your last solution in it (the starter code if you have none)"
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-[4px] border border-dashed border-brass bg-brass/10 font-sans text-[12px] font-semibold tracking-[0.02em] text-brass transition-colors hover:bg-brass/20 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                    >
                      <Flag className="size-3.5" />
                      {hasSolution ? "New solution from your last one" : "New solution"}
                    </button>
                  </div>
                  {submit && (
                    <div className="mt-2 mr-4 ml-[3.75rem] pl-3">
                      <SubmitBlock submit={submit} foldAll={foldAll} />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer: the course editor's bar, with the tutor's controls on the left. */}
            <div className="flex h-[52px] flex-shrink-0 items-center gap-2 border-t border-rule-strong bg-surface-void px-4 select-none">
              {showGetHelp ? (
                <button type="button" onClick={getHelp} disabled={!chat.exampleEnabled} className={FILLED_BUTTON}>
                  <Sparkles className="size-3.5" />
                  Get help
                </button>
              ) : (
                chat.helpStarted &&
                !chat.isControl && (
                  <button
                    type="button"
                    onClick={getHelp}
                    disabled={!chat.exampleEnabled || chat.exhausted || chat.isTyping}
                    title={chat.exampleStatus ?? "New example"}
                    className={OUTLINE_BUTTON}
                  >
                    <Sparkles className="size-3.5" />
                    Example
                  </button>
                )
              )}
              <span className="ml-2 hidden min-w-0 truncate text-[10px] text-ink-label md:block">
                Ctrl/⌘+Enter run · Shift+Enter run and next · Ctrl/⌘+M code ⇄ markdown
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFoldAll((f) => ({ open: !f.open, n: f.n + 1 }))}
                  title={foldAll.open ? "Fold every output and the problem" : "Unfold every output and the problem"}
                  className={cn(OUTLINE_BUTTON, "text-ink-label")}
                >
                  {foldAll.open ? <ChevronsDownUp className="size-3.5" /> : <ChevronsUpDown className="size-3.5" />}
                  {foldAll.open ? "Collapse all" : "Expand all"}
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
                    onClick={submitNotebook}
                    disabled={!loaded || submitting || !!runningId}
                    title={hasSolution ? "Grade your newest solution cell" : "Grade all the code cells together"}
                    className={FILLED_BUTTON}
                  >
                    {submitting && <Loader2 className="size-3.5 animate-spin" />}
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
