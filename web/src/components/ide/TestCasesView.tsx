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
                                <div key={idx} className={`rounded-lg border p-3 bg-zinc-950/20 select-none ${
                                    hasResult 
                                        ? passed 
                                            ? "border-palm/20 bg-palm/[0.03]" 
                                            : "border-red-500/20 bg-red-500/[0.03]"
                                        : "border-zinc-800"
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-zinc-400 text-xs">Case {idx + 1} (Hidden)</span>
                                        {hasResult && (
                                            <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                                                passed ? "text-palm bg-palm/10 border border-palm/15" : "text-red-400 bg-red-500/10 border border-red-500/15"
                                            }`}>
                                                {passed ? "Passed" : "Failed"}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-zinc-500 italic text-[11px] leading-normal">
                                        Hidden test case outputs are withheld for grading integrity.
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <div key={idx} className={`rounded-lg border p-3 bg-zinc-950/20 ${
                                hasResult 
                                    ? passed 
                                        ? "border-palm/20 bg-palm/[0.03]" 
                                        : "border-red-500/20 bg-red-500/[0.03]"
                                    : "border-zinc-800"
                            }`}>
                                <div className="flex items-center justify-between mb-2.5 border-b border-zinc-800/50 pb-1.5">
                                    <div className="space-y-0.5">
                                        <span className="font-semibold text-zinc-300 text-xs font-sans">Case {idx + 1}</span>
                                        {tc.description && (
                                            <span className="block text-[9px] text-zinc-550 font-sans">{tc.description}</span>
                                        )}
                                    </div>
                                    {hasResult && (
                                        <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                                            passed ? "text-palm bg-palm/10 border border-palm/15" : "text-red-400 bg-red-500/10 border border-red-500/15"
                                        }`}>
                                            {passed ? "Passed" : "Failed"}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2 text-[11px]">
                                    <div>
                                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-semibold mb-0.5 font-sans">Input</span>
                                        <pre className="p-2 rounded bg-zinc-950 text-zinc-300 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed border border-zinc-900">
                                            {tc.input || "(Empty Input)"}
                                        </pre>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-semibold mb-0.5 font-sans">Expected</span>
                                            <pre className="p-2 rounded bg-zinc-950 text-zinc-400 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed border border-zinc-900">
                                                {tc.expectedOutput || "(Empty Output)"}
                                            </pre>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-semibold mb-0.5 font-sans">Actual</span>
                                            <pre className={`p-2 rounded bg-zinc-950 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed border ${
                                                hasResult
                                                    ? passed
                                                        ? "text-palm border-palm/20"
                                                        : "text-red-400 border-red-550/20"
                                                    : "text-zinc-550 border-zinc-900"
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
