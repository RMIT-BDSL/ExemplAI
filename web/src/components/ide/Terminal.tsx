import { Loader2, Sparkles, X } from "lucide-react";
import TestCasesView from "./TestCasesView";

interface ExecutionResult {
    time?: string;
    memory?: number;
    compile_output?: string;
    stderr?: string;
    stdout?: string;
}

interface ExecutionStatusProps {
    executionResult: ExecutionResult;
    renderStatusBadge: () => React.ReactNode;
}

export function ExecutionStatus({
    executionResult,
    renderStatusBadge,
}: ExecutionStatusProps) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                    Status
                </span>
                {renderStatusBadge()}
            </div>

            {/* CPU / Memory Info */}
            {executionResult.time && (
                <div className="flex gap-4 text-right">
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-0.5">
                            Runtime
                        </span>
                        <span className="text-zinc-200 font-medium">
                            {Math.round(parseFloat(executionResult.time) * 1000)} ms
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-0.5">
                            Memory
                        </span>
                        <span className="text-zinc-200 font-medium">
                            {executionResult.memory
                                ? `${(executionResult.memory / 1024).toFixed(2)} MB`
                                : "N/A"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

interface CompilerOutputProps {
    output: string;
}

export function CompilerOutput({ output }: CompilerOutputProps) {
    return (
        <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-red-500/80 font-semibold block">
                Compiler Output
            </span>
            <pre className="rounded-md border border-red-500/10 bg-red-950/20 p-3 text-red-400 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-36">
                {output}
            </pre>
        </div>
    );
}

interface RuntimeStderrProps {
    stderr: string;
}

export function RuntimeStderr({ stderr }: RuntimeStderrProps) {
    return (
        <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-rose-500/80 font-semibold block">
                Runtime Stderr
            </span>
            <pre className="rounded-md border border-red-500/10 bg-red-950/20 p-3 text-rose-400 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-36">
                {stderr}
            </pre>
        </div>
    );
}

interface StdoutPreviewProps {
    stdout?: string;
    setActiveTab: (tab: "result" | "stdout") => void;
}

export function StdoutPreview({ stdout, setActiveTab }: StdoutPreviewProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
                    Standard Output (stdout)
                </span>
                <button
                    type="button"
                    onClick={() => setActiveTab("stdout")}
                    className="text-[10px] text-emerald-500 hover:underline"
                >
                    View full output
                </button>
            </div>
            <pre className="rounded-md bg-zinc-950 p-3 text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-32">
                {stdout}
            </pre>
        </div>
    );
}

interface FullStdoutProps {
    stdout?: string;
}

export function FullStdout({ stdout }: FullStdoutProps) {
    return (
        <pre className="h-full w-full rounded-md bg-zinc-950 p-3 text-zinc-300 overflow-auto whitespace-pre-wrap leading-relaxed">
            {stdout}
        </pre>
    );
}

export function SuccessEmptyOutput() {
    return (
        <div className="text-zinc-500 italic py-2">
            Code executed successfully with empty output.
        </div>
    );
}

export function ConsolePlaceholder() {
    return (
        <div className="flex h-full w-full items-center justify-center text-zinc-500 italic">
            Run your code to see the execution results here.
        </div>
    );
}

interface TerminalProps {
    setActiveTab: (tab: "result" | "stdout" | "testcases") => void;
    hasStdout: boolean;
    isLoading: boolean;
    executionResult: ExecutionResult | null | undefined;
    activeTab: "result" | "stdout" | "testcases";
    setIsConsoleOpen: (open: boolean) => void;
    renderStatusBadge: () => React.ReactNode;
    onSendErrorToChat?: (error: string) => void;
    testCases: any[];
}

export default function Terminal({
    setActiveTab,
    hasStdout,
    isLoading,
    executionResult,
    activeTab,
    setIsConsoleOpen,
    renderStatusBadge,
    onSendErrorToChat,
    testCases,
}: TerminalProps) {
    const errorText =
        executionResult?.compile_output || executionResult?.stderr || "";
    return (
        <div className="flex h-full flex-col overflow-hidden text-sm text-zinc-300">
            {/* Drawer Header */}
            <div className="flex h-11 items-stretch justify-between border-b border-zinc-800 bg-zinc-900/50 px-4">
                <div className="flex items-stretch gap-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab("testcases")}
                        className={`border-b-2 px-3 flex items-center text-xs font-semibold transition-colors ${activeTab === "testcases"
                            ? "border-emerald-500 text-emerald-500"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                            }`}
                    >
                        Test Cases
                    </button>
                    {executionResult && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("result")}
                            className={`border-b-2 px-3 flex items-center text-xs font-semibold transition-colors ${activeTab === "result"
                                ? "border-emerald-500 text-emerald-500"
                                : "border-transparent text-zinc-400 hover:text-zinc-200"
                                }`}
                        >
                            Result
                        </button>
                    )}
                    {hasStdout && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("stdout")}
                            className={`border-b-2 px-3 flex items-center text-xs font-semibold transition-colors ${activeTab === "stdout"
                                ? "border-emerald-500 text-emerald-500"
                                : "border-transparent text-zinc-400 hover:text-zinc-200"
                                }`}
                        >
                            Stdout
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setIsConsoleOpen(false)}
                    className="self-center rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                >
                    <X className="size-4" />
                </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
                {isLoading ? (
                    <div className="flex h-full w-full flex-col items-center justify-center text-zinc-400">
                        <Loader2 className="size-6 animate-spin text-emerald-500" />
                        <span className="mt-2 text-zinc-400">
                            Executing student code against testing harness...
                        </span>
                    </div>
                ) : (
                    activeTab === "testcases" ? (
                        <TestCasesView testCases={testCases} executionResult={executionResult} />
                    ) : executionResult ? (
                        activeTab === "result" ? (
                            <div className="space-y-4">
                                <ExecutionStatus
                                    executionResult={executionResult}
                                    renderStatusBadge={renderStatusBadge}
                                />

                                {executionResult.compile_output && (
                                    <CompilerOutput output={executionResult.compile_output} />
                                )}

                                {executionResult.stderr && (
                                    <RuntimeStderr stderr={executionResult.stderr} />
                                )}

                                {!executionResult.compile_output &&
                                    !executionResult.stderr &&
                                    !executionResult.stdout && <SuccessEmptyOutput />}

                                {!executionResult.compile_output &&
                                    !executionResult.stderr &&
                                    executionResult.stdout && (
                                        <StdoutPreview
                                            stdout={executionResult.stdout}
                                            setActiveTab={setActiveTab}
                                        />
                                    )}

                                {errorText && onSendErrorToChat && (
                                    <button
                                        type="button"
                                        onClick={() => onSendErrorToChat(errorText)}
                                        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition-colors active:scale-95"
                                    >
                                        <Sparkles className="size-3.5" />
                                        <span>Ask AI about this error</span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <FullStdout stdout={executionResult.stdout} />
                        )
                    ) : (
                        <ConsolePlaceholder />
                    )
                )}
            </div>
        </div>
    );
}
