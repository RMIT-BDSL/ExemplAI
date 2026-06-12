import { useRef, useState } from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import axios from 'axios'
import CodeEditor from '#/components/student/CodeEditor'
import CodingBar from '#/components/student/InteractionBar'
import ResetCodeForm from '#/components/student/ResetCodeForm'

export const Route = createFileRoute('/')({ component: Home })

const CODE_TEMPLATES = {
  python: `def main():\n    # Write your Python code here\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()`,
  javascript: `function main() {\n    // Write your JavaScript code here\n    console.log("Hello, World!");\n}\n\nmain();`,
  cpp: `#include <iostream>\n\nint main() {\n    // Write your C++ code here\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        // Write your Java code here\n        System.out.println("Hello, World!");\n    }\n}`,
}

function Home() {
  const editorRef = useRef<any>(null)
  const url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  const [language, setLanguage] = useState<string>('python')
  const [fontSize, setFontSize] = useState<number>(14)
  const [codeTemplates, setCodeTemplates] = useState(CODE_TEMPLATES)
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [executionResult, setExecutionResult] = useState<any>(null)
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false)
  const [showResetModal, setShowResetModal] = useState<boolean>(false)

  function handleEditorMount(editor: any, monaco: any) {
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
        <div className="flex flex-1 flex-col overflow-hidden p-3 w-full h-full">
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            {/* Top Toolbar */}
            <CodingBar
              language={language}
              setLanguage={setLanguage}
              fontSize={fontSize}
              setFontSize={setFontSize}
              onResetClick={() => setShowResetModal(true)}
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
        </div>

        {/* Solid Reset Confirmation Modal */}
        {showResetModal && (
          <ResetCodeForm setShowResetModal={setShowResetModal} handleReset={handleReset} />
        )}
      </div>
    </ClientOnly>
  )
}
