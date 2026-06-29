import React from "react";

interface TestCase {
    input: string;
    expectedOutput: string;
    description?: string;
    hidden?: boolean;
}

interface TestCasesViewProps {
    testCases: TestCase[];
    executionResult: any;
}

export default function TestCasesView({ testCases, executionResult }: TestCasesViewProps) {
    const testResults = executionResult?.test_results || [];

    return (
        <div className="space-y-4">
            {testCases.length === 0 ? (
                <div className="text-zinc-500 italic py-2 text-center">
                    No test cases configured for this lesson.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {testCases.map((tc, idx) => {
                        const result = testResults[idx];
                        const hasResult = !!result;
                        const passed = result?.passed;

                        if (tc.hidden) {
                            return (
                                <div key={idx} className={`rounded-lg border p-4 bg-zinc-900/40 select-none ${
                                    hasResult 
                                        ? passed 
                                            ? "border-emerald-500/30 bg-emerald-950/5" 
                                            : "border-rose-500/30 bg-rose-950/5"
                                        : "border-zinc-800/80"
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-zinc-400">Case {idx + 1} (Hidden)</span>
                                        {hasResult && (
                                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                                                passed ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/10" : "text-rose-400 bg-rose-500/10 border border-rose-500/10"
                                            }`}>
                                                {passed ? "Passed" : "Failed"}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-zinc-500 italic text-xs leading-normal">
                                        Hidden test case outputs are withheld for grading integrity.
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <div key={idx} className={`rounded-lg border p-4 bg-zinc-900/40 ${
                                hasResult 
                                    ? passed 
                                        ? "border-emerald-500/30 bg-emerald-950/5" 
                                        : "border-rose-500/30 bg-rose-950/5"
                                    : "border-zinc-800/80"
                            }`}>
                                <div className="flex items-center justify-between mb-3 border-b border-zinc-800/50 pb-2">
                                    <div className="space-y-0.5">
                                        <span className="font-semibold text-zinc-300">Case {idx + 1}</span>
                                        {tc.description && (
                                            <span className="block text-[10px] text-zinc-500 font-sans">{tc.description}</span>
                                        )}
                                    </div>
                                    {hasResult && (
                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                                            passed ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/10" : "text-rose-400 bg-rose-500/10 border border-rose-500/10"
                                        }`}>
                                            {passed ? "Passed" : "Failed"}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2 text-xs">
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-semibold mb-0.5">Input</span>
                                        <pre className="p-2 rounded bg-zinc-950/80 text-zinc-300 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed border border-zinc-900/60">
                                            {tc.input || "(Empty Input)"}
                                        </pre>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-semibold mb-0.5">Expected</span>
                                            <pre className="p-2 rounded bg-zinc-950/80 text-zinc-400 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed border border-zinc-900/60">
                                                {tc.expectedOutput || "(Empty Output)"}
                                            </pre>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-semibold mb-0.5">Actual</span>
                                            <pre className={`p-2 rounded bg-zinc-950/80 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed border ${
                                                hasResult
                                                    ? passed
                                                        ? "text-emerald-400 border-emerald-500/10"
                                                        : "text-rose-400 border-rose-500/20"
                                                    : "text-zinc-500 border-zinc-900/60"
                                            }`}>
                                                {hasResult ? result.stdout || "(Empty Output)" : "-"}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
