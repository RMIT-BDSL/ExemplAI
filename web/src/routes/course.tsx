
import { useRef, useState } from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import axios from 'axios'
import { BookOpen, ChevronLeft } from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import CodeEditor from '#/components/student/CodeEditor'
import CodingBar from '#/components/student/InteractionBar'
import ResetCodeForm from '#/components/student/ResetCodeForm'
import SidePanel from '#/components/student/SidePane'
import Problem from '#/components/student/problem/Problem'

export const Route = createFileRoute('/course')({
    component: Course,
    validateSearch: (search: Record<string, unknown>) => {
        return {
            problemId: (search.problemId as string) || undefined,
        }
    },
})

const CODE_TEMPLATES = {
    python: `def main():\n    # Write your Python code here\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()`,
    /*
    javascript: `function main() {\n    // Write your JavaScript code here\n    console.log("Hello, World!");\n}\n\nmain();`,
    cpp: `#include <iostream>\n\nint main() {\n    // Write your C++ code here\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}`,
    java: `public class Main {\n    // Write your Java code here\n    System.out.println("Hello, World!");\n    }\n}`,
    */
}

function Course() {
    const editorRef = useRef<any>(null)
    const url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

    const { problemId } = Route.useSearch()

    const questions = useQuery(api.courses.getAllCourses)
    const fetchedQuestion = useQuery(
        api.courses.getQuestionById,
        problemId ? { id: problemId } : "skip"
    )

    const [language, setLanguage] = useState<string>('python')
    const [fontSize, setFontSize] = useState<number>(14)
    const [codeTemplates, setCodeTemplates] = useState(CODE_TEMPLATES)
    const [isRunning, setIsRunning] = useState<boolean>(false)
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
    const [executionResult, setExecutionResult] = useState<any>(null)
    const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false)
    const [showResetModal, setShowResetModal] = useState<boolean>(false)
    const [isProblemCollapsed, setIsProblemCollapsed] = useState<boolean>(false)
    const [isChatCollapsed, setIsChatCollapsed] = useState<boolean>(true)

    const activeQuestion = problemId
        ? fetchedQuestion
        : (questions && questions.length > 0 ? questions[0] : null)

    if (activeQuestion === undefined) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100">
                <div className="text-center space-y-4">
                    <p className="text-zinc-500 text-sm animate-pulse">Loading workspace...</p>
                </div>
            </div>
        )
    }

    if (activeQuestion === null) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100">
                <p className="text-zinc-400">No problems available in the database.</p>
            </div>
        )
    }

    const mappedProblem = {
        id: activeQuestion._id,
        title: activeQuestion.problem_name,
        description: activeQuestion.problem_description,
        tags: ["Python"],
    }

    function handleEditorMount(editor: any) {
        editorRef.current = editor
    }

    function handleCodeChange(value: string | undefined) {
        if (value !== undefined) {
            setCodeTemplates((prev) => ({
                ...prev,
                [language]: value,
            }))
        }
    }

    function handleReset() {
        setCodeTemplates((prev) => ({
            ...prev,
            [language]: CODE_TEMPLATES[language as keyof typeof CODE_TEMPLATES],
        }))
        if (editorRef.current) {
            editorRef.current.setValue(CODE_TEMPLATES[language as keyof typeof CODE_TEMPLATES])
        }
    }

    async function handleExecute(actionType: 'run' | 'submit') {
        if (!editorRef.current) return

        if (actionType === 'run') {
            setIsRunning(true)
        } else {
            setIsSubmitting(true)
        }

        setExecutionResult(null)
        setIsConsoleOpen(true) // Auto-open console drawer when running

        const submissionCode = editorRef.current.getValue()

        try {
            const response = await axios.post(`${url}/execute`, {
                code: submissionCode,
            })
            setExecutionResult(response.data)
        } catch (error: any) {
            setExecutionResult({
                error: true,
                message: error.message || 'Execution failed',
                stderr: error.response?.data?.detail || error.response?.data?.message || error.message,
            })
        } finally {
            setIsRunning(false)
            setIsSubmitting(false)
        }
    }

    const currentCode = codeTemplates[language as keyof typeof codeTemplates] || ''

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
                            setIsChatCollapsed={setIsChatCollapsed}
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
                                onRun={() => handleExecute('run')}
                                onSubmit={() => handleExecute('submit')}
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
                    <ResetCodeForm setShowResetModal={setShowResetModal} handleReset={handleReset} />
                )}
            </div>
        </ClientOnly>
    )
}
