import { Editor } from "@monaco-editor/react";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2, Play, RotateCcw, TerminalSquare } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { scratchpadExecute } from "#/lib/api.ts";

export interface ScratchpadHandle {
	openWith: (code: string, language?: string) => void;
}

const LANGUAGES: Record<string, { label: string; id: number }> = {
	python: { label: "Python", id: 71 },
	javascript: { label: "JavaScript", id: 63 },
	typescript: { label: "TypeScript", id: 74 },
	java: { label: "Java", id: 62 },
	cpp: { label: "C++", id: 54 },
	go: { label: "Go", id: 60 },
	rust: { label: "Rust", id: 73 },
};

const DEFAULT_LANG = "python";
const DEFAULT_TEMPLATE = `# Scratchpad — freely experiment here
def greet(name):
    return f"Hello, {name}!"

print(greet("world"))
`;

const Scratchpad = forwardRef<ScratchpadHandle>(function Scratchpad(_props, ref) {
	const editorRef = useRef<any>(null);
	const [language, setLanguage] = useState<string>(DEFAULT_LANG);
	const [value, setValue] = useState<string>(() => {
		const saved = localStorage.getItem("exemplai_scratchpad");
		return saved && saved.trim() ? saved : DEFAULT_TEMPLATE;
	});
	const [stdin, setStdin] = useState<string>("");
	const [isRunning, setIsRunning] = useState<boolean>(false);
	const [result, setResult] = useState<any>(null);

	useImperativeHandle(ref, () => ({
		openWith(code: string, lang?: string) {
			let key: string = lang ?? "";
			key = key.toLowerCase();
			if (key === "python3" || key === "py") key = "python";
			if (!LANGUAGES[key]) key = DEFAULT_LANG;
			setLanguage(key);
			setValue(code);
			setResult(null);
			if (editorRef.current) {
				editorRef.current.setValue(code);
			}
		},
	}));

	function handleEditorMount(editor: any) {
		editorRef.current = editor;
	}

	function handleChange(next: string | undefined) {
		const v = next ?? "";
		setValue(v);
		localStorage.setItem("exemplai_scratchpad", v);
	}

	async function handleRun() {
		if (isRunning) return;
		setIsRunning(true);
		setResult(null);
		try {
			const output = await scratchpadExecute(
				value,
				LANGUAGES[language].id,
				stdin
			);
			setResult(output);
		} catch (err: any) {
			setResult({
				error: true,
				stderr: err?.response?.data?.detail || err?.message || "Execution failed",
			});
		} finally {
			setIsRunning(false);
		}
	}

	function handleReset() {
		setValue(DEFAULT_TEMPLATE);
		setStdin("");
		setResult(null);
		localStorage.setItem("exemplai_scratchpad", DEFAULT_TEMPLATE);
		if (editorRef.current) {
			editorRef.current.setValue(DEFAULT_TEMPLATE);
		}
	}

	const statusId = result?.status?.id ?? result?.status_id;
	const isAccepted = statusId === 3;

	const hasError = Boolean(result?.stderr || result?.compile_output || result?.error);

	return (
		<ClientOnly>
			<div className="flex h-full flex-col overflow-hidden bg-zinc-950 select-none">
				{/* Scratchpad Toolbar */}
				<div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 flex-shrink-0">
					<div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
						<TerminalSquare className="size-3.5 text-lagoon" />
						<span>Scratchpad</span>
					</div>
					<select
						value={language}
						onChange={(e) => {
							setLanguage(e.target.value);
							setResult(null);
						}}
						className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300 outline-none focus:border-zinc-600 cursor-pointer"
					>
						{Object.entries(LANGUAGES).map(([key, lang]) => (
							<option key={key} value={key}>
								{lang.label}
							</option>
						))}
					</select>
				</div>

				{/* Editor */}
				<div className="flex-1 min-h-0">
					<Editor
						onMount={handleEditorMount}
						height="100%"
						language={language}
						value={value}
						onChange={handleChange}
						theme="vs-dark"
						options={{
							minimap: { enabled: false },
							fontSize: 13,
							lineHeight: 21,
							fontFamily:
								"'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
							cursorBlinking: "smooth",
							smoothScrolling: true,
							padding: { top: 10, bottom: 10 },
							automaticLayout: true,
							scrollbar: { vertical: "visible", horizontal: "visible" },
						}}
					/>
				</div>

				{/* stdin input */}
				<div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 py-1.5">
					<div className="flex items-center gap-2">
						<span className="w-14 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
							stdin
						</span>
						<input
							value={stdin}
							onChange={(e) => setStdin(e.target.value)}
							placeholder="Optional program input..."
							className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono text-[11px] text-zinc-200 placeholder-zinc-650 outline-none focus:border-zinc-600"
						/>
					</div>
				</div>

				{/* Output Console */}
				<div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900">
					<div className="flex h-8 items-center justify-between border-b border-zinc-800 bg-zinc-950/60 px-4">
						<span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
							Output
						</span>
						{result && (
							<div
								className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
									isAccepted
										? "text-palm border-palm/15 bg-palm/10"
										: "text-red-500 border-red-500/15 bg-red-500/10"
								}`}
							>
								<div className="size-1.5 rounded-full bg-current" />
								<span>
									{isAccepted
										? "Ran successfully"
										: result?.status?.description || "Error"}
								</span>
							</div>
						)}
					</div>
					<div className="max-h-40 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-relaxed">
						{isRunning ? (
							<div className="flex items-center gap-2 text-zinc-400">
								<Loader2 className="size-3.5 animate-spin text-lagoon" />
								<span>Executing...</span>
							</div>
						) : !result ? (
							<div className="text-zinc-600 italic">
								Run your snippet to see the output here.
							</div>
						) : (
							<div className="space-y-2">
								{(result.compile_output || result.stderr) && (
									<pre className="whitespace-pre-wrap text-rose-400">
										{result.compile_output || result.stderr}
									</pre>
								)}
								{result.stdout ? (
									<pre className="whitespace-pre-wrap text-zinc-300">
										{result.stdout}
									</pre>
								) : (
									!result.compile_output &&
									!result.stderr && (
										<div className="text-zinc-500 italic">
											Executed successfully with empty output.
										</div>
									)
								)}
								{!hasError && result.time && (
									<div className="text-[10px] text-zinc-500">
										Runtime {Math.round(parseFloat(result.time) * 1000)} ms
									</div>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Action Bar */}
				<div className="flex h-11 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-4 flex-shrink-0">
					<button
						type="button"
						onClick={handleReset}
						className="flex items-center gap-1.2 rounded-md border border-zinc-800 bg-zinc-800/40 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
					>
						<RotateCcw className="size-3.5" />
						<span>Reset</span>
					</button>
					<button
						type="button"
						onClick={handleRun}
						disabled={isRunning}
						className="flex items-center gap-1.2 rounded-md bg-lagoon px-4 py-1 text-xs font-semibold text-white hover:bg-lagoon-deep disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
					>
						{isRunning ? (
							<Loader2 className="size-3.5 animate-spin" />
						) : (
							<Play className="size-3.5 fill-current" />
						)}
						<span>Run</span>
					</button>
				</div>
			</div>
		</ClientOnly>
	);
});

export default Scratchpad;