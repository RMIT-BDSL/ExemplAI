import { Editor } from "@monaco-editor/react";
import { ClientOnly } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronUp, Loader2, Play } from "lucide-react";
import { useState } from "react";
import Terminal from "../ide/Terminal";

interface CodeEditorProps {
	onMount: (editor: any, monaco: any) => void;
	language: string;
	value: string;
	onChange: (value: string | undefined) => void;
	fontSize: number;
	isRunning: boolean;
	isSubmitting: boolean;
	executionResult: any;
	isConsoleOpen: boolean;
	setIsConsoleOpen: (open: boolean) => void;
	onRun: () => void;
	onSubmit: () => void;
	onSendErrorToChat?: (error: string) => void;
	isSaved: boolean;
	onSave: () => void;
	testCases: any[];
}

export default function CodeEditor({
	onMount,
	language,
	value,
	onChange,
	fontSize,
	isRunning,
	isSubmitting,
	executionResult,
	isConsoleOpen,
	setIsConsoleOpen,
	onRun,
	onSubmit,
	onSendErrorToChat,
	isSaved,
	onSave,
	testCases,
}: CodeEditorProps) {
	const [activeTab, setActiveTab] = useState<"result" | "stdout" | "testcases">("testcases");

	// Set default tab when new execution results arrive
	const hasStdout = executionResult && executionResult.stdout;

	const isLoading = isRunning || isSubmitting;

	// Format Status Badge
	const renderStatusBadge = () => {
		if (!executionResult) return null;

		const statusId = executionResult.status?.id;
		const statusDesc = executionResult.status?.description || "Unknown Status";

		let badgeColor = "text-red-500 border-red-500/20 bg-red-500/10";
		if (statusId === 3) {
			// Accepted
			badgeColor = "text-emerald-500 border-emerald-500/20 bg-emerald-500/10";
		} else if (statusId === 4) {
			// Wrong Answer
			badgeColor = "text-amber-500 border-amber-500/20 bg-amber-500/10";
		} else if (statusId === 5 || statusId === 6) {
			// TLE or Compile Error
			badgeColor = "text-rose-500 border-rose-500/20 bg-rose-500/10";
		}

		return (
			<div
				className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badgeColor}`}
			>
				<div
					className={`size-1.5 rounded-full ${statusId === 3 ? "bg-emerald-500" : "bg-red-500"}`}
				/>
				<span>{statusDesc}</span>
			</div>
		);
	};

	return (
		<ClientOnly>
			<div className="flex flex-1 flex-col overflow-hidden relative bg-zinc-950">
				{/* Editor Area */}
				<div className="flex-1 overflow-hidden min-h-0">
					<Editor
						onMount={onMount}
						height="100%"
						language={language}
						value={value}
						onChange={onChange}
						theme="vs-dark"
						loading={
							<div className="flex h-full w-full items-center justify-center bg-zinc-950 text-zinc-400">
								<Loader2 className="size-6 animate-spin text-emerald-500" />
								<span className="ml-2 text-sm">
									Loading code environment...
								</span>
							</div>
						}
						options={{
							minimap: { enabled: false },
							fontSize: fontSize,
							lineHeight: 22,
							fontFamily:
								"'Fira Code', Menlo, Monaco, 'Courier New', monospace",
							cursorBlinking: "smooth",
							cursorSmoothCaretAnimation: "on",
							smoothScrolling: true,
							padding: { top: 12, bottom: 12 },
							roundedSelection: true,
							automaticLayout: true,
							scrollbar: {
								vertical: "visible",
								horizontal: "visible",
								useShadows: false,
								verticalHasArrows: false,
								horizontalHasArrows: false,
							},
						}}
					/>
				</div>

				{/* Console Drawer */}
				<div
					className={`bg-zinc-900 border-t border-zinc-800 transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${
						isConsoleOpen
							? "h-[280px] opacity-100"
							: "h-0 border-t-0 opacity-0 pointer-events-none"
					}`}
				>
					{isConsoleOpen && (
						<Terminal
							setActiveTab={setActiveTab}
							hasStdout={hasStdout}
							isLoading={isLoading}
							executionResult={executionResult}
							activeTab={activeTab}
							setIsConsoleOpen={setIsConsoleOpen}
							renderStatusBadge={renderStatusBadge}
							onSendErrorToChat={onSendErrorToChat}
							testCases={testCases}
						/>
					)}
				</div>

				{/* Footer / Execution Action Bar */}
				<div className="flex h-11 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-4 select-none flex-shrink-0">
					<button
						type="button"
						onClick={() => setIsConsoleOpen(!isConsoleOpen)}
						className="flex items-center gap-1.5 rounded-md bg-zinc-800/40 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors font-medium border border-zinc-800"
					>
						<span>Console</span>
						{isConsoleOpen ? (
							<ChevronDown className="size-3.5" />
						) : (
							<ChevronUp className="size-3.5" />
						)}
					</button>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onSave}
							disabled={isSaved}
							className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold border transition-all ${
								isSaved
									? "bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed select-none"
									: "bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500 active:scale-95"
							}`}
						>
							<span>{isSaved ? "Saved" : "Save"}</span>
						</button>

						<button
							type="button"
							onClick={onRun}
							disabled={isLoading}
							className="flex items-center gap-1.5 rounded-md border border-zinc-750 bg-zinc-800/60 px-4 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 transition-all active:scale-95"
						>
							{isRunning ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<Play className="size-3.5 fill-current" />
							)}
							<span>Run Code</span>
						</button>

						<button
							type="button"
							onClick={onSubmit}
							disabled={isLoading}
							className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-md shadow-emerald-950/20 active:scale-95"
						>
							{isSubmitting ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<Check className="size-3.5 stroke-[3]" />
							)}
							<span>Submit Solution</span>
						</button>
					</div>
				</div>
			</div>
		</ClientOnly>
	);
}
