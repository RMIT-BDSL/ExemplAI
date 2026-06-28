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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
    problemId ? { id: problemId } : "skip"
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
  // A message pushed into the AI chat from the terminal "Ask AI" button. The
  // key changes on every push so the same error can be sent more than once.
  const [chatPrompt, setChatPrompt] = useState<{
    key: number;
    content: string;
  } | null>(null);

  const activeQuestion = problemId
    ? fetchedQuestion
    : questions && questions.length > 0
      ? questions[0]
      : null;

  const [isSaved, setIsSaved] = useState<boolean>(true);

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

  // Load code template from localStorage, falling back to starter_code or defaults
  useEffect(() => {
    if (activeQuestion && problemId) {
      const storageKey = `exemplai_code_${problemId}_${language}`;
      const savedCode = localStorage.getItem(storageKey);

      if (savedCode) {
        setCodeTemplates((prev) => ({
          ...prev,
          [language]: savedCode,
        }));
        if (editorRef.current) {
          editorRef.current.setValue(savedCode);
        }
        setIsSaved(true);
      } else if (activeQuestion.starter_code) {
        setCodeTemplates((prev) => ({
          ...prev,
          [language]: activeQuestion.starter_code,
        }));
        if (editorRef.current) {
          editorRef.current.setValue(activeQuestion.starter_code);
        }
        setIsSaved(true);
      } else {
        const defaultCode = CODE_TEMPLATES[language as keyof typeof CODE_TEMPLATES] || "";
        setCodeTemplates((prev) => ({
          ...prev,
          [language]: defaultCode,
        }));
        if (editorRef.current) {
          editorRef.current.setValue(defaultCode);
        }
        setIsSaved(true);
      }
    }
  }, [activeQuestionId, language, problemId]);

  // Autosave code to localStorage every 5 seconds if there are changes
  useEffect(() => {
    if (!problemId) return;

    const interval = setInterval(() => {
      if (!isSaved && editorRef.current) {
        const currentVal = editorRef.current.getValue();
        const storageKey = `exemplai_code_${problemId}_${language}`;
        localStorage.setItem(storageKey, currentVal);
        setIsSaved(true);
        toast.info("Autosaved progress locally.");
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [problemId, language, isSaved]);

  if (activeQuestion === undefined) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <Loader2 className="size-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (activeQuestion === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-400">
        No questions found.
      </div>
    );
  }

  const sidebarProblems = questions || [];
  const mappedProblem = {
    id: activeQuestion._id,
    title: activeQuestion.problem_name,
    description: activeQuestion.problem_description,
    detail: activeQuestion.detail,
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
      setIsSaved(false);
    }
  }

  const handleSave = () => {
    if (!problemId || !editorRef.current) return;
    const currentVal = editorRef.current.getValue();
    const storageKey = `exemplai_code_${problemId}_${language}`;
    localStorage.setItem(storageKey, currentVal);
    setIsSaved(true);
    toast.success("Progress saved locally.");
  };

  function handleReset() {
    posthog.capture("code_reset", { problem_id: problemId, language });
    const defaultCode =
      activeQuestion?.starter_code || CODE_TEMPLATES[language as keyof typeof CODE_TEMPLATES] || "";
    setCodeTemplates((prev) => ({
      ...prev,
      [language]: defaultCode,
    }));
    if (editorRef.current) {
      editorRef.current.setValue(defaultCode);
    }
    setIsSaved(false);
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

    const LANGUAGE_IDS = {
      python: 71,
      javascript: 63,
      typescript: 74,
      cpp: 54,
      java: 62,
      go: 60,
      rust: 73,
      sql: 82,
    };
    const activeLang = language.toLowerCase();
    const languageId = LANGUAGE_IDS[activeLang as keyof typeof LANGUAGE_IDS] || 71;

    // Filter test cases based on actionType
    const allTestCases = activeQuestion?.testCases || [];
    const testCasesToRun =
      actionType === "run" ? allTestCases.filter((tc: any) => !tc.hidden) : allTestCases;

    try {
      const response = await axios.post(`${url}/execute`, {
        code: submissionCode,
        language_id: languageId,
        starter_code: activeQuestion?.starter_code,
        solution_code: activeQuestion?.solution_code,
        test_cases: testCasesToRun,
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
        stderr: error.response?.data?.detail || error.response?.data?.message || error.message,
      });
    } finally {
      setIsRunning(false);
      setIsSubmitting(false);
    }
  }

  // Build a prompt from the current error + the student's code + the problem
  // id, open the chat, and hand it to the AI assistant (which posts it to the
  // /chat route on the backend).
  function handleSendErrorToChat(error: string) {
    const code = editorRef.current?.getValue() ?? currentCode;
    const content = [
      `I ran into an error on problem \`${activeQuestionId}\` (${activeQuestion?.problem_name ?? "this problem"}).`,
      "",
      "Here is my code:",
      "```python",
      code,
      "```",
      "",
      "And here is the error I got:",
      "```",
      error,
      "```",
      "",
      "Can you help me understand what went wrong and how to fix it?",
    ].join("\n");

    posthog.capture("error_sent_to_chat", {
      problem_id: problemId,
      language,
    });

    setIsChatCollapsed(false);
    setChatPrompt((prev) => ({ key: (prev?.key ?? 0) + 1, content }));
  }

  const currentCode = codeTemplates[language as keyof typeof codeTemplates] || "";

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
                if (!collapsed) posthog.capture("ai_chat_opened", { problem_id: problemId });
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
                onSendErrorToChat={handleSendErrorToChat}
                isSaved={isSaved}
                onSave={handleSave}
              />
            </div>
          </div>

          {/* Chat Panel */}
          {!isChatCollapsed && (
            <div className="flex h-full w-[420px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl text-zinc-100 flex-shrink-0">
              <SidePanel onCollapse={() => setIsChatCollapsed(true)} pendingMessage={chatPrompt} />
            </div>
          )}
        </div>

        {/* Solid Reset Confirmation Modal */}
        {showResetModal && (
          <ResetCodeForm setShowResetModal={setShowResetModal} handleReset={handleReset} />
        )}
      </div>
    </ClientOnly>
  );
}
