import { Editor } from "@monaco-editor/react";
import { ClientOnly } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
} from "lucide-react";
import ConsoleDrawer, { type ConsoleRun } from "../ide/ConsoleDrawer";

interface CodeEditorProps {
  onMount: (editor: any, monaco: any) => void;
  beforeMount?: (monaco: any) => void;
  theme: string;
  language: string;
  value: string;
  onChange: (value: string | undefined) => void;
  fontSize: number;
  isRunning: boolean;
  isSubmitting: boolean;
  runs: ConsoleRun[];
  onClearRuns: () => void;
  isConsoleOpen: boolean;
  setIsConsoleOpen: (open: boolean) => void;
  onRun: () => void;
  onSubmit: () => void;
  /** Set only after a passing Submit: the Submit button turns into "Next lesson". */
  onNextLesson?: () => void;
}

export default function CodeEditor({
  onMount,
  beforeMount,
  theme,
  language,
  value,
  onChange,
  fontSize,
  isRunning,
  isSubmitting,
  runs,
  onClearRuns,
  isConsoleOpen,
  setIsConsoleOpen,
  onRun,
  onSubmit,
  onNextLesson,
}: CodeEditorProps) {
  const isLoading = isRunning || isSubmitting;

  return (
    <ClientOnly>
      <div className="flex flex-1 flex-col overflow-hidden relative bg-surface-editor">
        {/* Editor Area */}
        <div className="flex-1 overflow-hidden min-h-0">
          <Editor
            beforeMount={beforeMount}
            onMount={onMount}
            height="100%"
            language={language}
            value={value}
            onChange={onChange}
            theme={theme}
            loading={
              <div className="flex h-full w-full items-center justify-center bg-surface-editor text-ink-label">
                <Loader2 className="size-5 animate-spin text-brass" />
                <span className="ml-2 text-xs font-medium">
                  Loading code environment...
                </span>
              </div>
            }
            options={{
              minimap: { enabled: false },
              fontSize: fontSize,
              lineHeight: 22,
              fontFamily:
                "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              smoothScrolling: true,
              padding: { top: 12, bottom: 12 },
              roundedSelection: true,
              automaticLayout: true,
              // No empty page below the last line, so the scrollbar only
              // appears when the code is taller than the editor.
              scrollBeyondLastLine: false,
              // Floating scrollbars: hidden until the pointer is over the
              // editor or it scrolls, thin, no track.
              scrollbar: {
                vertical: "auto",
                horizontal: "auto",
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
                useShadows: false,
                verticalHasArrows: false,
                horizontalHasArrows: false,
              },
            }}
          />
        </div>

        {/* Console drawer: run log (opens on Run) */}
        {isConsoleOpen && (
          <div className="h-60 flex-shrink-0 border-t border-rule-strong">
            <ConsoleDrawer
              runs={runs}
              isRunning={isRunning}
              onClear={onClearRuns}
              onClose={() => setIsConsoleOpen(false)}
            />
          </div>
        )}

        {/* Footer: Console · Run (unscored) · Submit, which becomes Next lesson after a pass */}
        <div className="flex h-[52px] flex-shrink-0 select-none items-center justify-between border-t border-rule-strong bg-surface-void px-6 [&_button]:h-8">
          <button
            type="button"
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
            aria-expanded={isConsoleOpen}
            className={`flex h-7 items-center gap-1.5 rounded-[2px] border border-rule bg-surface-raised px-3 text-[11px] font-medium tracking-[0.02em] transition-colors cursor-pointer hover:text-brass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
              isConsoleOpen ? "text-brass" : "text-ink"
            }`}
          >
            Console
            {isConsoleOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronUp className="size-3.5" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRun}
              disabled={isLoading}
              title="Run (Ctrl+Enter, or ⌘+Enter on Mac)"
              aria-keyshortcuts="Control+Enter Meta+Enter"
              className="flex h-7 items-center gap-1.5 rounded-[2px] border border-rule-strong bg-transparent px-3 text-[11px] font-medium tracking-[0.02em] text-brass transition-colors hover:bg-surface-raised disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {isRunning ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3 fill-current" />
              )}
              Run
            </button>
            {onNextLesson ? (
              <button
                type="button"
                onClick={onNextLesson}
                className="flex h-7 items-center gap-1.5 rounded-[2px] border border-brass-fill bg-brass-fill px-3 text-[11px] font-semibold tracking-[0.02em] text-on-brass transition-opacity hover:opacity-90 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
              >
                Next lesson
                <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={isLoading}
                className="flex h-7 items-center gap-1.5 rounded-[2px] border border-brass-fill bg-brass-fill px-3 text-[11px] font-semibold tracking-[0.02em] text-on-brass transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
              >
                {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                Submit
              </button>
            )}
          </div>
        </div>
      </div>
    </ClientOnly>
  );
}
