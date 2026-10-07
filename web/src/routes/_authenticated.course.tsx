import { usePostHog } from "@posthog/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { Lock, RotateCcw, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "#/lib/utils.ts";
import ResetCodeForm from "#/components/student/ResetCodeForm";

// Heavy, non-LCP subtrees — kept out of the initial route chunk.
// Monaco (via CodeEditor) alone is several hundred KB of JS.
const CodeEditor = lazy(() => import("#/components/student/CodeEditor"));
const SidePanel = lazy(() => import("#/components/student/SidePane"));
import LessonIndex from "#/components/student/LessonIndex";
import LessonExposition from "#/components/student/LessonExposition";
import ResizeHandle from "#/components/ide/ResizeHandle";
import { formatCall, type SubmitRecord } from "#/components/student/problem/Problem";
import type { ConsoleRun } from "#/components/ide/ConsoleDrawer";
import LessonSkeleton from "#/components/student/LessonSkeleton";
import StatusBar from "#/components/student/StatusBar";
import { authClient } from "#/lib/auth-client";
import { useLessonVisit } from "#/lib/useLessonVisit";
import { api } from "../../convex/_generated/api";


// Shown above a lesson's starter code in the editor (on first load and on
// Reset). Display only: grading reads the function name from the lesson's
// starter_code, and a comment doesn't change what the code does.
const STARTER_HINT = "# replace 'pass' with your function code";

function withStarterHint(starter: string): string {
  if (!/\bpass\b/.test(starter) || starter.startsWith(STARTER_HINT)) return starter;
  return `${STARTER_HINT}\n${starter}`;
}

// Resizable lesson columns (≥1100px): minimum widths so no column gets too small.
const WIDE_PX = 1100;
const DESC_MIN = 260;
const TUTOR_MIN = 300;
const EDITOR_MIN = 360;
const LAYOUT_KEY = "exemplai_layout";

function clampWidth(width: number, min: number, max: number) {
  return Math.round(Math.max(min, Math.min(width, Math.max(min, max))));
}
export const Route = createFileRoute("/_authenticated/course")({
  component: Course,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      problemId: (search.problemId as string) || undefined,
    };
  },
  loaderDeps: ({ search: { problemId } }) => ({ problemId }),
  loader: ({ context, deps }) => {
    // Warm the cache on hover-preload so the reactive subscriptions are already
    // populated by the time the component mounts. Non-blocking on purpose.
    void context.queryClient.prefetchQuery(
      convexQuery(api.courses.getAllCourses, {})
    );
    void context.queryClient.prefetchQuery(
      convexQuery(
        api.courses.getQuestionById,
        deps.problemId ? { id: deps.problemId } : "skip"
      )
    );
  },
});

// Monaco themes built from the workspace tokens (styles.css --xa-*).
// Monaco needs literal hex values, so keep these in step with the tokens.
const EDITOR_THEMES = {
  exemplaiLight: {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8a8580", fontStyle: "italic" },
      { token: "keyword", foreground: "8a6420", fontStyle: "bold" },
      { token: "string", foreground: "3c6f50" },
      { token: "number", foreground: "8a6420" },
      { token: "operator", foreground: "5f5b64" },
    ],
    colors: {
      "editor.background": "#fbf9f4",
      "editor.foreground": "#1c1b1f",
      "editorLineNumber.foreground": "#a39d93",
      "editorLineNumber.activeForeground": "#8a6420",
      "editor.lineHighlightBackground": "#f0e7d4",
      "editor.lineHighlightBorder": "#00000000",
      "editorGutter.background": "#fbf9f4",
      "editorCursor.foreground": "#8a6420",
      "editor.selectionBackground": "#e9dcc0",
      "editor.inactiveSelectionBackground": "#f0e7d4",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#d8d2c766",
      "scrollbarSlider.hoverBackground": "#c9c1b399",
      "scrollbarSlider.activeBackground": "#b8ae9ebb",
    },
  },
  exemplaiDark: {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6e6d73", fontStyle: "italic" },
      { token: "keyword", foreground: "c29a53", fontStyle: "bold" },
      { token: "string", foreground: "769480" },
      { token: "number", foreground: "b89053" },
      { token: "operator", foreground: "9f9da4" },
    ],
    colors: {
      "editor.background": "#141318",
      "editor.foreground": "#eaeaea",
      "editorLineNumber.foreground": "#4f4d54",
      "editorLineNumber.activeForeground": "#c29a53",
      "editor.lineHighlightBackground": "#1e1d24",
      "editor.lineHighlightBorder": "#00000000",
      "editorGutter.background": "#141318",
      "editorCursor.foreground": "#c29a53",
      "editor.selectionBackground": "#282630",
      "editor.inactiveSelectionBackground": "#1e1d24",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#3a384166",
      "scrollbarSlider.hoverBackground": "#4a485299",
      "scrollbarSlider.activeBackground": "#5a5862bb",
    },
  },
} as const;

function defineEditorThemes(monaco: any) {
  for (const [name, theme] of Object.entries(EDITOR_THEMES)) {
    monaco.editor.defineTheme(name, theme);
  }
}

const CODE_TEMPLATES = {
  python: `def main():\n    # Write your Python code here\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()`,
};

function Course() {
  const editorRef = useRef<any>(null);
  const posthog = usePostHog();
  const { resolvedTheme } = useTheme();
  const editorTheme = resolvedTheme === "dark" ? "exemplaiDark" : "exemplaiLight";
  const url = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const { problemId } = Route.useSearch();

  const { data: questions } = useQuery(convexQuery(api.courses.getAllCourses, {}));
  const { data: fetchedQuestion } = useQuery(
    convexQuery(
      api.courses.getQuestionById,
      problemId ? { id: problemId } : "skip"
    )
  );

  const { data: session } = authClient.useSession();
  const tokenIdentifier = session?.user?.id;
  const setLessonStatus = useMutation(api.courses.setLessonStatus);
  const openLesson = useMutation(api.examples.openLesson);
  const { data: lessonProgress } = useQuery(
    convexQuery(
      api.courses.getLessonProgress,
      tokenIdentifier ? {} : "skip"
    )
  );
  // Lessons unlock one at a time within each week (convex/lessonAccess.ts);
  // null = no locks (admins, or LESSON_LOCKS=off for testing).
  const { data: unlocked } = useQuery(
    convexQuery(
      api.lessonAccess.getUnlockedLessons,
      tokenIdentifier ? {} : "skip"
    )
  );

  // Python is the only course language; the editor font size is fixed.
  const language = "python";
  const fontSize = 14;
  const [codeTemplates, setCodeTemplates] = useState(CODE_TEMPLATES);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // Console log of Runs (and Submits that hit a code error); per lesson, per session.
  const [runs, setRuns] = useState<ConsoleRun[]>([]);
  const runIdRef = useRef(0);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  // This session's Submits on the current lesson, newest first, shown in the
  // Description column. Tagged with their lesson so a new lesson never shows the
  // previous one's results, even for a frame. Not persisted (cleared on reload).
  const [submitHistory, setSubmitHistory] = useState<SubmitRecord[]>([]);
  // The tutor is pinned open on wide screens. Below 1100px it collapses to a
  // rail; isTutorOpen then shows it as an overlay (×, Esc or click outside closes).
  const [isTutorOpen, setIsTutorOpen] = useState<boolean>(false);
  const tutorRef = useRef<HTMLDivElement | null>(null);
  const tutorRailRef = useRef<HTMLButtonElement | null>(null);
  const [isIndexOpen, setIsIndexOpen] = useState<boolean>(false);


  const activeQuestion = problemId
    ? fetchedQuestion
    : questions === undefined
      ? undefined
      : questions.length > 0
        ? questions[0]
        : null;

  // Autosave (no indicator): edits are written to sessionStorage shortly after
  // typing stops, and flushed on lesson change, unmount and page hide. Saved
  // code survives a reload in the same browser session only; a new session
  // starts every lesson fresh from its starter code.
  const pendingSaveRef = useRef<{ key: string; code: string } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runShortcutRef = useRef<() => void>(() => {});
  function flushSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const pending = pendingSaveRef.current;
    if (pending) sessionStorage.setItem(pending.key, pending.code);
    pendingSaveRef.current = null;
  }

  const activeQuestionId = activeQuestion?._id;
  const activeProgress = lessonProgress?.find((p: any) => p.lessonId === activeQuestionId);
  const lessonSubmits = submitHistory.filter((s) => s.lessonId === activeQuestionId);
  const lastSubmit = lessonSubmits[0];
  // Failed Submits on this lesson; the first unlocks Get help in the chat.
  const failedSubmits: number = activeProgress?.failed_submits ?? 0;

  const currentIndex = questions?.findIndex((q: any) => q._id === activeQuestionId) ?? -1;
  const unlockedSet = unlocked ? new Set<string>(unlocked) : unlocked;
  // Locked until the lesson before it (same week) is completed. The panel
  // clears itself as soon as that pass is recorded, e.g. after "Next lesson".
  const isLocked = !!activeQuestionId && !!unlockedSet && !unlockedSet.has(activeQuestionId);
  const canOpen = unlocked !== undefined && !isLocked;
  const previousQuestion =
    currentIndex > 0 && questions && questions[currentIndex - 1]?.week === activeQuestion?.week
      ? questions[currentIndex - 1]
      : null;
  const nextQuestion =
    currentIndex !== -1 && questions && currentIndex < questions.length - 1
      ? questions[currentIndex + 1]
      : null;

  const navigate = useNavigate();
  // After 3 failed Submits the next lesson opens anyway (convex/lessonAccess.ts):
  // say so, so a stuck student knows they can move on and come back later.
  const moveOn =
    unlockedSet &&
    nextQuestion &&
    nextQuestion.week === activeQuestion?.week &&
    unlockedSet.has(nextQuestion._id) &&
    activeProgress?.status !== "completed"
      ? nextQuestion
      : null;

  const handleNextLesson = nextQuestion
    ? () => {
        navigate({
          to: "/course",
          search: { problemId: nextQuestion._id },
        });
        setIsConsoleOpen(false);
      }
    : undefined;

  // Submit results are per lesson and per session.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the lesson changes
  useEffect(() => {
    setSubmitHistory([]);
    setRuns([]);
  }, [activeQuestionId]);

  useEffect(() => {
    if (tokenIdentifier && activeQuestionId && canOpen) {
      setLessonStatus({
        lessonId: activeQuestionId,
        status: "in-progress",
      }).catch(() => {});
      // Coming back from another lesson resets a used-up example allowance.
      openLesson({ lessonId: activeQuestionId }).catch(() => {});
    }
  }, [tokenIdentifier, activeQuestionId, canOpen, setLessonStatus, openLesson]);

  // Time on task: a visit per lesson opening, with active time (research log).
  useLessonVisit(tokenIdentifier && canOpen ? activeQuestionId : undefined);

  useEffect(() => {
    if (activeQuestion && problemId) {
      const storageKey = `exemplai_code_${problemId}_${language}`;
      const savedCode = sessionStorage.getItem(storageKey);

      if (savedCode) {
        setCodeTemplates((prev) => ({
          ...prev,
          [language]: savedCode,
        }));
        if (editorRef.current) {
          editorRef.current.setValue(savedCode);
        }
      } else if (activeQuestion.starter_code) {
        const starter = withStarterHint(activeQuestion.starter_code);
        setCodeTemplates((prev) => ({
          ...prev,
          [language]: starter,
        }));
        if (editorRef.current) {
          editorRef.current.setValue(starter);
        }
      } else {
        const defaultCode = CODE_TEMPLATES[language as keyof typeof CODE_TEMPLATES] || "";
        setCodeTemplates((prev) => ({
          ...prev,
          [language]: defaultCode,
        }));
        if (editorRef.current) {
          editorRef.current.setValue(defaultCode);
        }
      }
    }
  }, [activeQuestionId, language, problemId]);

  // Resizable columns (wide screens only, where all three sit side by side).
  // Widths are a per-browser convenience; null = the default CSS width.
  const descRef = useRef<HTMLDivElement | null>(null);
  const [isWide, setIsWide] = useState(false);
  const [descWidth, setDescWidth] = useState<number | null>(null);
  const [tutorWidth, setTutorWidth] = useState<number | null>(null);

  useEffect(() => {
    const wide = window.matchMedia(`(min-width: ${WIDE_PX}px)`);
    const update = () => setIsWide(wide.matches);
    update();
    wide.addEventListener("change", update);
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "{}");
      if (typeof saved.desc === "number") setDescWidth(saved.desc);
      if (typeof saved.tutor === "number") setTutorWidth(saved.tutor);
    } catch {}
    return () => wide.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ desc: descWidth, tutor: tutorWidth }));
    } catch {}
  }, [descWidth, tutorWidth]);

  // Each side keeps a minimum width, and the editor keeps at least EDITOR_MIN.
  function dragDescription(clientX: number) {
    const d = descRef.current?.getBoundingClientRect();
    const t = tutorRef.current?.getBoundingClientRect();
    if (!d || !t) return;
    setDescWidth(clampWidth(clientX - d.left, DESC_MIN, t.left - d.left - EDITOR_MIN));
  }

  function dragTutor(clientX: number) {
    const d = descRef.current?.getBoundingClientRect();
    const t = tutorRef.current?.getBoundingClientRect();
    if (!d || !t) return;
    setTutorWidth(clampWidth(t.right - clientX, TUTOR_MIN, t.right - d.right - EDITOR_MIN));
  }

  // A smaller window can leave the editor too narrow: re-apply the limits.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-clamp on resize only
  useEffect(() => {
    if (!isWide) return;
    const reclamp = () => {
      const d = descRef.current?.getBoundingClientRect();
      const t = tutorRef.current?.getBoundingClientRect();
      if (d && descWidth !== null) dragDescription(d.right);
      if (t && tutorWidth !== null) dragTutor(t.left);
    };
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [isWide, descWidth, tutorWidth]);

  // Crossing the 1100px breakpoint resets the overlay (pinned ⇄ rail).
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1099px)");
    const reset = () => setIsTutorOpen(false);
    narrow.addEventListener("change", reset);
    return () => narrow.removeEventListener("change", reset);
  }, []);

  useEffect(() => {
    if (!isTutorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsTutorOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (tutorRef.current?.contains(target) || tutorRailRef.current?.contains(target)) return;
      // Leave dialogs (reset confirm, account menu) alone.
      if ((target as Element).closest?.("[role=dialog],[role=alertdialog],[role=menu]")) return;
      setIsTutorOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [isTutorOpen]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: flushSave only touches refs
  useEffect(() => {
    window.addEventListener("pagehide", flushSave);
    return () => {
      window.removeEventListener("pagehide", flushSave);
      flushSave();
    };
  }, [problemId]);

  if (activeQuestion === undefined) {
    return <LessonSkeleton />;
  }

  if (activeQuestion === null) {
    return (
      <div className="xa-workspace flex h-dvh w-screen items-center justify-center bg-surface-page text-ink-label">
        No questions found.
      </div>
    );
  }

  // The example is the first visible test case (hidden tests are never shown).
  const exampleIndex = (activeQuestion.testCases ?? []).findIndex((tc: any) => !tc.hidden);
  const firstTest = exampleIndex >= 0 ? activeQuestion.testCases?.[exampleIndex] : undefined;
  const mappedProblem = {
    id: activeQuestion._id,
    title: activeQuestion.problem_name,
    description: activeQuestion.problem_description,
    // The function students write: from the starter code, else the lesson name.
    functionName:
      /def\s+(\w+)\s*\(/.exec(activeQuestion.starter_code ?? "")?.[1] ?? activeQuestion.problem_name,
    example: firstTest
      ? { input: firstTest.input, expectedOutput: firstTest.expectedOutput }
      : undefined,
  };

  // Ctrl+Enter (Cmd+Enter on Mac) in the editor runs the code, like the Run
  // button. The ref (declared above the early returns) keeps the shortcut
  // pointing at the latest state/lesson.
  runShortcutRef.current = () => {
    if (!isRunning && !isSubmitting) handleExecute("run");
  };

  function handleEditorMount(editor: any, monaco: any) {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runShortcutRef.current());
  }

  function handleCodeChange(value: string | undefined) {
    if (value !== undefined) {
      setCodeTemplates((prev) => ({
        ...prev,
        [language]: value,
      }));
      if (problemId) {
        pendingSaveRef.current = { key: `exemplai_code_${problemId}_${language}`, code: value };
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(flushSave, 800);
      }
    }
  }

  function handleReset() {
    posthog.capture("code_reset", { problem_id: problemId, language });
    const defaultCode =
      (activeQuestion?.starter_code && withStarterHint(activeQuestion.starter_code)) ||
      CODE_TEMPLATES[language as keyof typeof CODE_TEMPLATES] ||
      "";
    setCodeTemplates((prev) => ({
      ...prev,
      [language]: defaultCode,
    }));
    if (editorRef.current) {
      editorRef.current.setValue(defaultCode);
    }
  }

  function addRun(entry: Omit<ConsoleRun, "id" | "at">) {
    runIdRef.current += 1;
    setRuns((prev) => [...prev, { ...entry, id: runIdRef.current, at: new Date() }]);
  }

  async function handleExecute(actionType: "run" | "submit") {
    if (!editorRef.current) return;
    const isRun = actionType === "run";

    if (isRun) {
      setIsRunning(true);
      // Run always shows its output.
      setIsConsoleOpen(true);
    } else {
      setIsSubmitting(true);
    }

    const submissionCode: string = editorRef.current.getValue();
    const example = firstTest;

    try {
      const { default: axios } = await import("axios");
      const tokenRes = await authClient.convex.token();
      const token = tokenRes.data?.token;

      const response = await axios.post(
        `${url}/execute`,
        {
          code: submissionCode,
          language_id: 71, // Python 3 (Judge0)
          starter_code: activeQuestion?.starter_code,
          solution_code: activeQuestion?.solution_code,
          // Run calls the function once on the Description's example; Submit grades every test.
          test_cases: isRun ? (example ? [example] : []) : activeQuestion?.testCases || [],
          lesson_id: activeQuestionId ?? undefined,
          action_type: actionType,
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      const data = response.data;
      const succeeded = !data?.error;

      if (isRun) {
        const stderr: string = data?.stderr ?? "";
        addRun({
          kind: "run",
          timeMs: data?.time_ms ?? null,
          call: example ? formatCall(mappedProblem.functionName, example.input) : undefined,
          returnValue: data?.return_value ?? null,
          stdout: data?.stdout ?? "",
          stderr,
          inputNote: /EOFError/.test(stderr) && /\binput\s*\(/.test(submissionCode),
        });
      } else {
        const results: any[] = data?.test_results ?? [];
        // test_results follow the order of the test cases sent.
        const first = exampleIndex >= 0 ? results[exampleIndex] : undefined;
        const record: SubmitRecord = {
          lessonId: activeQuestion?._id ?? "",
          at: new Date(),
          passed: results.filter((r) => r.passed).length,
          total: results.length,
          example:
            first && !first.hidden
              ? { passed: !!first.passed, stdout: first.stdout ?? "", stderr: first.stderr ?? "" }
              : undefined,
        };
        setSubmitHistory((prev) => [record, ...prev]);
        // Submit results live in the Description; the console opens only when
        // the code itself failed (syntax or runtime error), to show the trace.
        const codeError =
          data?.status?.id === 6
            ? data?.stderr
            : results.find((r) => !r.hidden && r.stderr)?.stderr;
        if (codeError) {
          addRun({ kind: "submit", stdout: "", stderr: codeError, inputNote: false });
          setIsConsoleOpen(true);
        }
        // A failed Submit unlocks Get help: on narrow screens, bring the tutor into view.
        if (!succeeded && window.matchMedia("(max-width: 1099px)").matches) {
          setIsTutorOpen(true);
        }
      }
      posthog.capture(isRun ? "code_run" : "code_submitted", {
        problem_id: problemId,
        language,
        success: succeeded,
      });
    } catch (error: any) {
      posthog.captureException(error);
      addRun({
        kind: "error",
        stdout: "",
        stderr:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          `Couldn't reach the code runner (${error.message || "request failed"}). Try again in a moment.`,
        inputNote: false,
      });
      setIsConsoleOpen(true);
    } finally {
      setIsRunning(false);
      setIsSubmitting(false);
    }
  }

  const currentCode = codeTemplates[language as keyof typeof codeTemplates] || "";
  const passedThisSession =
    !!lastSubmit && lastSubmit.total > 0 && lastSubmit.passed === lastSubmit.total;


  function handleExampleRequested(trigger: "get_help" | "new_example", examplesUsed: number) {
    posthog.capture(trigger === "get_help" ? "get_help_clicked" : "new_example_clicked", {
      problem_id: problemId,
      failed_submits: failedSubmits,
      examples_used: examplesUsed,
    });
  }

  // Navigation is handled by the <Link> in LessonIndex; this just resets
  // the transient run state so the console doesn't carry over between lessons.
  function handleSelectLesson(_id: string) {
    setIsConsoleOpen(false);
  }

  return (
      <div className="xa-workspace flex h-dvh w-full flex-col bg-surface-page text-ink antialiased overflow-hidden">
        <StatusBar
          week={activeQuestion?.week}
          topic={activeQuestion?.topic}
          isIndexOpen={isIndexOpen}
          onOpenIndex={() => setIsIndexOpen(true)}
        />

        {/* Workspace Spread Container */}
        <div className="relative flex flex-1 flex-row overflow-hidden w-full bg-surface-page">
          {/* Lesson index drawer (opened from the status bar) */}
          <LessonIndex
            isIndexOpen={isIndexOpen}
            setIsIndexOpen={setIsIndexOpen}
            questions={questions}
            activeQuestionId={activeQuestionId}
            lessonProgress={lessonProgress}
            unlocked={unlockedSet}
            onSelectLesson={handleSelectLesson}
          />

          {isLocked ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <Lock className="size-5 text-ink-label" aria-hidden="true" />
              <p className="font-serif text-[1.1rem] text-ink">
                {activeQuestion?.problem_name} is locked
              </p>
              <p className="max-w-sm text-[12px] leading-relaxed text-ink-label">
                {previousQuestion ? (
                  <>
                    It unlocks when you pass{" "}
                    <Link
                      to="/course"
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
              <Link
                to="/"
                className="mt-2 text-[10px] uppercase tracking-[0.15em] text-ink-label hover:text-brass transition-colors"
              >
                Back to syllabus
              </Link>
            </div>
          ) : (
          <>

          {/* Description (Problem Panel) */}
          <LessonExposition
            mappedProblem={mappedProblem}
            submitHistory={lessonSubmits}
            moveOn={moveOn && handleNextLesson ? { name: moveOn.problem_name, onClick: handleNextLesson } : undefined}
            panelRef={descRef}
            width={isWide && descWidth ? descWidth : undefined}
          />
          <ResizeHandle
            label="Resize description"
            onDrag={dragDescription}
            onNudge={(delta) => {
              const d = descRef.current?.getBoundingClientRect();
              if (d) dragDescription(d.right + delta);
            }}
            onReset={() => setDescWidth(null)}
          />

          {/* Editor Panel */}
          <div className="flex flex-1 flex-col overflow-hidden bg-surface-editor editorial-editor-container">
            <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-rule-strong bg-surface-void px-6">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
                Editor
              </span>
              <div className="-mr-1 flex items-center">
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  aria-label="Reset to starter code"
                  title="Reset to starter code"
                  className="grid size-6 place-items-center rounded-[2px] text-ink-label hover:text-brass transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brass"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden relative">
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center bg-surface-editor text-[10px] uppercase tracking-[0.15em] text-ink-label">
                    Loading editor…
                  </div>
                }
              >
                <CodeEditor
                  beforeMount={defineEditorThemes}
                  theme={editorTheme}
                  onMount={handleEditorMount}
                  language={language}
                  value={currentCode}
                  onChange={handleCodeChange}
                  fontSize={fontSize}
                  isRunning={isRunning}
                  isSubmitting={isSubmitting}
                  runs={runs}
                  onClearRuns={() => setRuns([])}
                  isConsoleOpen={isConsoleOpen}
                  setIsConsoleOpen={setIsConsoleOpen}
                  onRun={() => handleExecute("run")}
                  onSubmit={() => handleExecute("submit")}
                  // After a passing Submit (this session), Submit becomes "Next lesson".
                  onNextLesson={passedThisSession ? handleNextLesson : undefined}
                />
              </Suspense>
            </div>
          </div>

          {/* Tutor rail (below 1100px): opens the tutor as an overlay */}
          <button
            ref={tutorRailRef}
            type="button"
            onClick={() => {
              posthog.capture("ai_chat_opened", { problem_id: problemId });
              setIsTutorOpen(true);
            }}
            aria-label="Open tutor"
            aria-expanded={isTutorOpen}
            aria-controls="tutor-panel"
            className="flex w-9 flex-shrink-0 flex-col items-center gap-3.5 border-l border-rule-strong bg-surface-panel pt-4 text-brass hover:bg-surface-raised transition-colors cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass min-[1100px]:hidden"
          >
            <span aria-hidden="true">◈</span>
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.2em]"
              style={{ writingMode: "vertical-rl" }}
            >
              Tutor
            </span>
          </button>

          <ResizeHandle
            label="Resize tutor"
            onDrag={dragTutor}
            onNudge={(delta) => {
              const t = tutorRef.current?.getBoundingClientRect();
              if (t) dragTutor(t.left + delta);
            }}
            onReset={() => setTutorWidth(null)}
          />

          {/* Tutor panel: pinned at ≥1100px (no hide control), overlay below */}
          <div
            ref={tutorRef}
            id="tutor-panel"
            style={isWide && tutorWidth ? { width: tutorWidth } : undefined}
            className={cn(
              "absolute inset-y-0 right-0 z-40 w-[min(400px,calc(100%-48px))] flex-col border-l border-rule-strong bg-surface-panel text-ink",
              "min-[1100px]:relative min-[1100px]:inset-auto min-[1100px]:z-auto min-[1100px]:flex min-[1100px]:w-[340px] min-[1100px]:flex-shrink-0 xl:w-[400px]",
              isTutorOpen ? "flex" : "hidden",
            )}
          >
            <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-rule-strong bg-surface-void px-6">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">Tutor</span>
              <button
                type="button"
                onClick={() => setIsTutorOpen(false)}
                aria-label="Close tutor"
                className="-mr-1 grid size-6 place-items-center rounded-[2px] text-ink-label hover:text-brass transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brass min-[1100px]:hidden"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 editorial-chat-container">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.15em] text-ink-label">
                    Loading tutor…
                  </div>
                }
              >
                <SidePanel
                  editorRef={editorRef}
                  currentCode={currentCode}
                  lessonId={activeQuestionId}
                  onExampleRequested={handleExampleRequested}
                />
              </Suspense>
            </div>
          </div>
          </>
          )}
        </div>

        {/* Solid Reset Confirmation Modal */}
        {showResetModal && (
          <ResetCodeForm setShowResetModal={setShowResetModal} handleReset={handleReset} />
        )}
      </div>
  );
}
