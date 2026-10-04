import { usePostHog } from "@posthog/react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import * as React from "react";
import { type ScratchpadRunResult, scratchpadExecute } from "#/lib/api.ts";

// Judge0 status 3 is "Accepted": the program ran to the end.
const JUDGE0_ACCEPTED = 3;
const PYTHON_LANGUAGE_ID = 71;

interface RunOutput {
  stdout: string;
  stderr: string;
  /** Shown when the run didn't finish normally and printed no traceback. */
  status: string | null;
  timeMs: number | null;
  /** The snippet called input(), which has no stdin here (EOFError). */
  inputNote: boolean;
}

function toOutput(r: ScratchpadRunResult): RunOutput {
  const stderr = [r.compile_output, r.stderr].filter(Boolean).join("\n");
  const finished = r.status?.id === JUDGE0_ACCEPTED;
  return {
    stdout: r.stdout ?? "",
    stderr,
    status: !finished && !stderr ? (r.status?.description ?? null) : null,
    timeMs: r.time != null ? Math.round(Number(r.time) * 1000) : null,
    inputNote: stderr.includes("EOFError"),
  };
}

/**
 * A tutor code block the student can edit and run in place, so trying an
 * example (filling a faded blank, testing a fix to an erroneous one) never
 * leaves the chat. Runs are ungraded and record no lesson progress; edits and
 * output live only for this session.
 */
export default function RunnableCodeBlock({ code }: { code: string }) {
  const posthog = usePostHog();
  const [source, setSource] = React.useState(code);
  const [isRunning, setIsRunning] = React.useState(false);
  const [output, setOutput] = React.useState<RunOutput | null>(null);
  const edited = source !== code;

  async function run() {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const result = await scratchpadExecute(source, PYTHON_LANGUAGE_ID);
      setOutput(toOutput(result));
      posthog.capture("chat_code_run", {
        edited,
        status: result.status?.description,
      });
    } catch (err: any) {
      setOutput({
        stdout: "",
        stderr: "",
        status: `Couldn't reach the code runner (${
          err?.response?.data?.detail || err?.message || "request failed"
        }). Try again in a moment.`,
        timeMs: null,
        inputNote: false,
      });
    } finally {
      setIsRunning(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      run();
    } else if (e.key === "Tab" && !e.shiftKey) {
      // Python needs indentation; Esc then Tab still moves focus on.
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: start, selectionEnd: end } = el;
      setSource(`${source.slice(0, start)}    ${source.slice(end)}`);
      requestAnimationFrame(() => el.setSelectionRange(start + 4, start + 4));
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  }

  return (
    <div className="not-prose my-2 rounded-[4px] border border-rule-strong bg-surface-page">
      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={source.split("\n").length}
        wrap="off"
        spellCheck={false}
        aria-label="Example code, editable"
        className="chat-code editorial-scroll block w-full resize-none select-text outline-none"
      />

      <div className="flex h-8 items-center gap-3 border-t border-rule px-2">
        <button
          type="button"
          onClick={run}
          disabled={isRunning}
          title="Run (Ctrl+Enter)"
          className="inline-flex h-6 items-center gap-1.5 rounded-[2px] border border-rule-strong px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-label transition-colors select-none hover:border-brass hover:text-brass cursor-pointer disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          {isRunning ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Play className="size-3" />
          )}
          {isRunning ? "Running" : "Run"}
        </button>
        {edited && (
          <button
            type="button"
            onClick={() => setSource(code)}
            className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.05em] text-ink-label transition-colors select-none hover:text-brass cursor-pointer"
          >
            <RotateCcw className="size-2.5" /> Undo edits
          </button>
        )}
      </div>

      {output && (
        <div
          className="border-t border-rule px-3 py-2 font-mono text-[11px] leading-[1.55] text-ink"
          aria-live="polite"
        >
          <div className="mb-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.15em] text-ink-label">
            Output{output.timeMs != null && ` · ${output.timeMs} ms`}
          </div>
          {output.stdout && (
            <pre className="whitespace-pre-wrap break-words">
              {output.stdout.replace(/\n$/, "")}
            </pre>
          )}
          {output.stderr && (
            <pre className="whitespace-pre-wrap break-words text-danger">
              {output.stderr.replace(/\n$/, "")}
            </pre>
          )}
          {output.status && (
            <p className="font-sans text-xs text-danger">{output.status}</p>
          )}
          {!output.stdout && !output.stderr && !output.status && (
            <p className="font-sans text-xs text-ink-label">
              Ran with no output. Add a print() to see a value.
            </p>
          )}
          {output.inputNote && (
            <p className="mt-1.5 font-sans text-xs leading-normal text-ink-prose">
              <b className="mr-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-brass">
                Note
              </b>
              input() doesn't work here. Put the value in the code instead, e.g.{" "}
              <span className="font-mono text-ink">n = 5</span>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
