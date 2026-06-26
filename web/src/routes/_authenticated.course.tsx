import { usePostHog } from "@posthog/react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import axios from "axios";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CodeEditor from "#/components/student/CodeEditor";
import CodingBar from "#/components/student/InteractionBar";
import Problem from "#/components/student/problem/Problem";
import ResetCodeForm from "#/components/student/ResetCodeForm";
import SidePanel from "#/components/student/SidePane";
import { authClient } from "#/lib/auth-client";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/_authenticated/course")({
  component: Course,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      problemId: (search.problemId as string) || undefined,
    };
  },
});

const CODE_TEMPLATES = {
  python: `def main():\n    # Write your Python code here\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()`,
};

function Course() {
  const editorRef = useRef<any>(null);
  const posthog = usePostHog();
  const url = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const { problemId } = Route.useSearch();

  const questions = useQuery(api.courses.getAllCourses);
  const fetchedQuestion = useQuery(
    api.courses.getQuestionById,
    problemId ? { id: problemId } : "skip",
  );

  // The Convex client isn't authenticated, so read the session from the
  // Better Auth client (same pattern as the rest of the app).
  const { data: session } = authClient.useSession();
  const tokenIdentifier = session?.user?.id;
  const setLessonStatus = useMutation(api.courses.setLessonStatus);

  const [language, setLanguage] = useState<string>("python");
  const [fontSize, setFontSize] = useState<number>(14);
  const [codeTemplates, setCodeTemplates] = useState(CODE_TEMPLATES);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [isProblemCollapsed, setIsProblemCollapsed] = useState<boolean>(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState<boolean>(true);

  const activeQuestion = problemId
    ? fetchedQuestion
    : questions && questions.length > 0
      ? questions[0]
      : null;

  // Opening a problem marks it "in-progress" (the server keeps it "completed"
  // if it already was, so reviewing a finished problem won't downgrade it).
  const activeQuestionId = activeQuestion?._id;
  useEffect(() => {
    if (tokenIdentifier && activeQuestionId) {
      setLessonStatus({
        tokenIdentifier,
        lessonId: activeQuestionId,
        status: "in-progress",
      }).catch(() => {});
    }
  }, [tokenIdentifier, activeQuestionId, setLessonStatus]);

  if (activeQuestion === undefined) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="text-center space-y-4">
          <p className="text-zinc-500 text-sm animate-pulse">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  if (activeQuestion === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-zinc-400">No problems available in the database.</p>
      </div>
    );
  }

  const mappedProblem = {
    id: activeQuestion._id,
    title: activeQuestion.problem_name,
    description: activeQuestion.problem_description,
    tags: ["Python"],
  };

  function handleEditorMount(editor: any) {
    editorRef.current = editor;
  }

  function handleCodeChange(value: string | undefined) {
    if (value !== undefined) {
      setCodeTemplates((prev) => ({
        ...prev,
        [language]: value,
      }));
    }
  }

  function handleReset() {
    posthog.capture("code_reset", { problem_id: problemId, language });
    setCodeTemplates((prev) => ({
      ...prev,
      [language]: CODE_TEMPLATES[language as keyof typeof CODE_TEMPLATES],
    }));
    if (editorRef.current) {
      editorRef.current.setValue(
        CODE_TEMPLATES[language as keyof typeof CODE_TEMPLATES],
      );
    }
  }

  async function handleExecute(actionType: "run" | "submit") {
    if (!editorRef.current) return;

    if (actionType === "run") {
      setIsRunning(true);
    } else {
      setIsSubmitting(true);
    }

    setExecutionResult(null);
    setIsConsoleOpen(true); // Auto-open console drawer when running

    const submissionCode = editorRef.current.getValue();

    try {
      const response = await axios.post(`${url}/execute`, {
        code: submissionCode,
      });
      setExecutionResult(response.data);
      const succeeded = !response.data?.error;
      posthog.capture(actionType === "run" ? "code_run" : "code_submitted", {
        problem_id: problemId,
        language,
        success: succeeded,
      });

      // Record progress on submit: a successful submission completes the
      // lesson; a failed attempt keeps it "in-progress" (the server won't
      // downgrade a lesson that's already completed).
      if (actionType === "submit" && tokenIdentifier && activeQuestionId) {
        setLessonStatus({
          tokenIdentifier,
          lessonId: activeQuestionId,
          status: succeeded ? "completed" : "in-progress",
        }).catch(() => {});
      }
    } catch (error: any) {
      posthog.captureException(error);

      // A submit that errors out is still a failed attempt → in-progress.
      if (actionType === "submit" && tokenIdentifier && activeQuestionId) {
        setLessonStatus({
          tokenIdentifier,
          lessonId: activeQuestionId,
          status: "in-progress",
        }).catch(() => {});
      }

      setExecutionResult({
        error: true,
        message: error.message || "Execution failed",
        stderr:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      });
    } finally {
      setIsRunning(false);
      setIsSubmitting(false);
    }
  }

  const currentCode =
    codeTemplates[language as keyof typeof codeTemplates] || "";

  return (
    <ClientOnly>
      <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100 antialiased overflow-hidden">
        {/* Workspace Container */}
        <div className="flex flex-1 flex-row overflow-hidden p-3 w-full h-full gap-3">
          {/* Problem Description Container */}
          {!isProblemCollapsed && (
            <div className="flex h-full w-[450px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl text-zinc-100 flex-shrink-0">
              {/* Header */}
              <div className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                  <BookOpen className="size-4 text-indigo-400" />
                  <span>Problem Description</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProblemCollapsed(true)}
                  className="rounded-md p-1 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
                  title="Collapse panel"
                >
                  <ChevronLeft className="size-4 text-zinc-400" />
                </button>
              </div>
              {/* Problem Content */}
              <div className="flex-1 min-h-0 bg-zinc-900/50">
                <Problem problem={mappedProblem} />
              </div>
            </div>
          )}

          {/* Code Editor Container */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            {/* Top Toolbar */}
            <CodingBar
              language={language}
              setLanguage={setLanguage}
              fontSize={fontSize}
              setFontSize={setFontSize}
              onResetClick={() => setShowResetModal(true)}
              isProblemCollapsed={isProblemCollapsed}
              setIsProblemCollapsed={setIsProblemCollapsed}
              isChatCollapsed={isChatCollapsed}
              setIsChatCollapsed={(collapsed) => {
                if (!collapsed)
                  posthog.capture("ai_chat_opened", { problem_id: problemId });
                setIsChatCollapsed(collapsed);
              }}
            />

            {/* Editor Container */}
            <div className="flex flex-1 flex-col overflow-hidden relative">
              <CodeEditor
                onMount={handleEditorMount}
                language={language}
                value={currentCode}
                onChange={handleCodeChange}
                fontSize={fontSize}
                isRunning={isRunning}
                isSubmitting={isSubmitting}
                executionResult={executionResult}
                isConsoleOpen={isConsoleOpen}
                setIsConsoleOpen={setIsConsoleOpen}
                onRun={() => handleExecute("run")}
                onSubmit={() => handleExecute("submit")}
              />
            </div>
          </div>

          {/* Chat Panel */}
          {!isChatCollapsed && (
            <div className="flex h-full w-[420px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl text-zinc-100 flex-shrink-0">
              <SidePanel onCollapse={() => setIsChatCollapsed(true)} />
            </div>
          )}
        </div>

        {/* Solid Reset Confirmation Modal */}
        {showResetModal && (
          <ResetCodeForm
            setShowResetModal={setShowResetModal}
            handleReset={handleReset}
          />
        )}
      </div>
    </ClientOnly>
  );
}
