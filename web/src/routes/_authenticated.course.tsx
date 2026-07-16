import { usePostHog } from "@posthog/react";
import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import axios from "axios";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CodeEditor from "#/components/student/CodeEditor";
import CodingBar from "#/components/student/InteractionBar";
import ResetCodeForm from "#/components/student/ResetCodeForm";
import SidePanel from "#/components/student/SidePane";
import LessonIndex from "#/components/student/LessonIndex";
import LessonExposition from "#/components/student/LessonExposition";
import { authClient } from "#/lib/auth-client";
import { api } from "../../convex/_generated/api";
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

  const { data: session } = authClient.useSession();
  const tokenIdentifier = session?.user?.id;
  const setLessonStatus = useMutation(api.courses.setLessonStatus);
  const lessonProgress = useQuery(
    api.courses.getLessonProgress,
    tokenIdentifier ? {} : "skip"
  );

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
  const [isIndexOpen, setIsIndexOpen] = useState<boolean>(false);

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

  useEffect(() => {
    document.body.classList.add("dark");
    return () => {
      document.body.classList.remove("dark");
    };
  }, []);

  const activeQuestionId = activeQuestion?._id;
  const isCompleted = lessonProgress?.find((p: any) => p.lessonId === activeQuestionId)?.status === "completed";

  const currentIndex = questions?.findIndex((q: any) => q._id === activeQuestionId) ?? -1;
  const nextQuestion =
    currentIndex !== -1 && questions && currentIndex < questions.length - 1
      ? questions[currentIndex + 1]
      : null;

  const navigate = useNavigate();
  const handleNextLesson = nextQuestion
    ? () => {
        navigate({
          to: "/course",
          search: { problemId: nextQuestion._id },
        });
        setExecutionResult(null);
        setIsConsoleOpen(false);
      }
    : undefined;

  useEffect(() => {
    if (tokenIdentifier && activeQuestionId) {
      setLessonStatus({
        lessonId: activeQuestionId,
        status: "in-progress",
      }).catch(() => {});
    }
  }, [tokenIdentifier, activeQuestionId, setLessonStatus]);

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

  useEffect(() => {
    if (!problemId) return;

    const interval = setInterval(() => {
      if (!isSaved && editorRef.current) {
        const currentVal = editorRef.current.getValue();
        const storageKey = `exemplai_code_${problemId}_${language}`;
        localStorage.setItem(storageKey, currentVal);
        setIsSaved(true);
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

  const mappedProblem = {
    id: activeQuestion._id,
    title: activeQuestion.problem_name,
    description: activeQuestion.problem_description,
    detail: activeQuestion.detail,
    tags: ["Python"],
  };

  function handleEditorMount(editor: any, monaco: any) {
    editorRef.current = editor;

    // Define an elegant editorial-style theme matching "Academic Nocturne"
    monaco.editor.defineTheme("academicNocturne", {
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
        "editor.background": "#0c0b0e",
        "editor.foreground": "#eaeaea",
        "editorLineNumber.foreground": "#4f4d54",
        "editorLineNumber.activeForeground": "#c29a53",
        "editor.lineHighlightBackground": "#131217",
        "editor.lineHighlightBorder": "#00000000",
        "editorGutter.background": "#0c0b0e",
        "editorCursor.foreground": "#c29a53",
        "editor.selectionBackground": "#282630",
        "editor.inactiveSelectionBackground": "#1e1d24",
      },
    });
    monaco.editor.setTheme("academicNocturne");
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
    setIsConsoleOpen(true);

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

    const allTestCases = activeQuestion?.testCases || [];
    const testCasesToRun =
      actionType === "run" ? allTestCases.filter((tc: any) => !tc.hidden) : allTestCases;

    try {
      const tokenRes = await authClient.convex.token();
      const token = tokenRes.data?.token;

      const response = await axios.post(
        `${url}/execute`,
        {
          code: submissionCode,
          language_id: languageId,
          starter_code: activeQuestion?.starter_code,
          solution_code: activeQuestion?.solution_code,
          test_cases: testCasesToRun,
          lesson_id: activeQuestionId ?? undefined,
          action_type: actionType,
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      setExecutionResult(response.data);
      const succeeded = !response.data?.error;
      posthog.capture(actionType === "run" ? "code_run" : "code_submitted", {
        problem_id: problemId,
        language,
        success: succeeded,
      });
    } catch (error: any) {
      posthog.captureException(error);

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

  function handleSelectLesson(id: string) {
    navigate({
      to: "/course",
      search: { problemId: id },
    });
    setExecutionResult(null);
    setIsConsoleOpen(false);
  }

  return (
    <ClientOnly>
      <div className="dark flex h-[calc(100vh-48px)] w-full flex-col bg-[#0b0a0d] text-zinc-100 antialiased overflow-hidden">
        {/* Running Header */}
        <div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-[#09080b] px-4 flex-shrink-0 font-sans text-[10px] uppercase tracking-[0.15em] text-zinc-500 select-none">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-400">ExemplAI</span>
            <span>·</span>
            <span>Course Reader</span>
          </div>
          <div className="font-serif italic text-zinc-400 font-normal normal-case">
            {activeQuestion?.problem_name}
          </div>
          <div>
            <span>Lesson {currentIndex + 1}</span>
          </div>
        </div>

        {/* Workspace Spread Container */}
        <div className="relative flex flex-1 flex-row overflow-hidden w-full bg-[#0b0a0d]">
          {/* Index of Lessons Sidebar */}
          <LessonIndex
            isIndexOpen={isIndexOpen}
            setIsIndexOpen={setIsIndexOpen}
            questions={questions}
            activeQuestionId={activeQuestionId}
            lessonProgress={lessonProgress}
            onSelectLesson={handleSelectLesson}
          />

          {/* Description (Problem Panel) */}
          <LessonExposition
            isProblemCollapsed={isProblemCollapsed}
            setIsProblemCollapsed={setIsProblemCollapsed}
            mappedProblem={mappedProblem}
          />

          {/* Editor Panel */}
          <div className="flex flex-1 flex-col overflow-hidden bg-[#0c0b0e] editorial-editor-container">
            <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#09080b] px-4 flex-shrink-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-[#c29a53] uppercase tracking-[0.15em]">
                <span>Editor</span>
              </div>
              <div className="flex items-center gap-4">
                {isProblemCollapsed && (
                  <button
                    type="button"
                    onClick={() => setIsProblemCollapsed(false)}
                    className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-400 hover:text-[#c29a53] transition-colors cursor-pointer"
                  >
                    <BookOpen className="size-3" />
                    <span>Show Description</span>
                  </button>
                )}
                {isChatCollapsed && (
                  <button
                    type="button"
                    onClick={() => {
                      posthog.capture("ai_chat_opened", { problem_id: problemId });
                      setIsChatCollapsed(false);
                    }}
                    className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-400 hover:text-[#c29a53] transition-colors cursor-pointer"
                  >
                    <span>Show Chat</span>
                  </button>
                )}
              </div>
            </div>

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
                testCases={activeQuestion?.testCases || []}
                isCompleted={isCompleted}
                onNextLesson={handleNextLesson}
              />
            </div>
          </div>

          {/* AI Chat Assistant Panel */}
          {!isChatCollapsed && (
            <div className="flex flex-col border-l border-zinc-800 bg-[#0c0b0e] text-zinc-100 flex-shrink-0 z-30 lg:relative lg:w-[340px] xl:w-[440px] lg:right-0 lg:top-0 lg:bottom-0 absolute right-0 top-0 bottom-0 w-[calc(100vw-20px)] md:w-[360px] transition-all duration-200">
              <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#09080b] px-4 flex-shrink-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-[#c29a53] uppercase tracking-[0.15em]">
                  <span>AI Assistant</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChatCollapsed(true)}
                  className="rounded-md p-1 text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer"
                  title="Collapse Chat"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 editorial-chat-container">
                <SidePanel onCollapse={() => setIsChatCollapsed(true)} pendingMessage={chatPrompt} editorRef={editorRef} currentCode={currentCode} lessonId={activeQuestionId} />
              </div>
            </div>
          )}
        </div>

        {/* Running Foot */}
        <div className="flex h-8 items-center justify-between border-t border-zinc-800 bg-[#09080b] px-4 text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-sans select-none flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[#c29a53] font-semibold">ExemplAI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className={isCompleted ? 'text-[#4f8a65]' : 'text-zinc-400'}>
              {isCompleted ? '❖ Completed' : '✦ In Progress'}
            </span>
          </div>
          <div>
            <span>Problem {currentIndex + 1} of {questions?.length || 1}</span>
          </div>
        </div>

        {/* Solid Reset Confirmation Modal */}
        {showResetModal && (
          <ResetCodeForm setShowResetModal={setShowResetModal} handleReset={handleReset} />
        )}
      </div>
    </ClientOnly>
  );
}
