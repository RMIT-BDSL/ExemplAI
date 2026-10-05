import { Eraser, Loader2, X } from "lucide-react";
import { useEffect, useRef } from "react";

/** One entry in the console log: a Run, or a Submit/request that errored. */
export interface ConsoleRun {
  id: number;
  kind: "run" | "submit" | "error";
  at: Date;
  timeMs?: number | null;
  /** The example call, e.g. `raiseToPower(2, 3)` (Run only). */
  call?: string;
  /** repr() of the call's return value; null when the call didn't finish. */
  returnValue?: string | null;
  stdout: string;
  stderr: string;
  /** The code called input(), which isn't available here (EOFError). */
  inputNote: boolean;
}

interface ConsoleDrawerProps {
  runs: ConsoleRun[];
  isRunning: boolean;
  onClear: () => void;
  onClose: () => void;
}

const KIND_LABEL: Record<ConsoleRun["kind"], string> = {
  run: "Run",
  submit: "Submit",
  error: "Error",
};

function timeOf(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Console drawer under the editor: a plain log of each Run's prints, the
 * example call's return value and any traceback, newest at the bottom.
 * Run is unscored, so nothing here says pass or fail.
 */
export default function ConsoleDrawer({
  runs,
  isRunning,
  onClear,
  onClose,
}: ConsoleDrawerProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Keep the newest run in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when entries or the running state change
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [runs.length, isRunning]);

  return (
    <section
      className="flex h-full flex-col bg-surface-panel"
      aria-label="Console output"
    >
      <div className="flex h-8 flex-shrink-0 items-center justify-between border-b border-rule px-6">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
          Console
        </span>
        <div className="-mr-1 flex items-center gap-1">
          <button
            type="button"
            onClick={onClear}
            disabled={runs.length === 0}
            aria-label="Clear console"
            title="Clear console"
            className="grid size-6 place-items-center rounded-[2px] text-ink-label hover:text-brass disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-default focus-visible:outline-2 focus-visible:outline-brass"
          >
            <Eraser className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close console"
            title="Close console"
            className="grid size-6 place-items-center rounded-[2px] text-ink-label hover:text-brass transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brass"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={bodyRef}
        className="console-log flex-1 min-h-0 overflow-y-auto px-6 py-3 font-mono text-xs leading-[1.6] text-ink"
        aria-live="polite"
      >
        {runs.length === 0 && !isRunning && (
          <p className="font-sans text-xs text-ink-label">
            Press Run to try your code. Your prints, the example call and any
            errors show here.
          </p>
        )}

        {runs.map((run) => (
          <div key={run.id} className="mb-3 last:mb-0">
            <div className="mb-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.15em] text-ink-label">
              {KIND_LABEL[run.kind]} · {timeOf(run.at)}
              {run.timeMs != null && ` · ${run.timeMs} ms`}
            </div>
            {run.stdout && (
              <pre className="whitespace-pre-wrap break-words">
                {run.stdout.replace(/\n$/, "")}
              </pre>
            )}
            {run.call && run.returnValue != null && !(run.returnValue === "None" && run.stdout) && (
              // A None return after printing is the normal case for "print"
              // exercises (and the grader treats printing and returning the
              // same), so it's hidden; with no output at all it's explained.
              <pre className="whitespace-pre-wrap break-words">
                {run.returnValue === "None" ? (
                  <span className="text-ink-label">
                    {run.call} returned None — it didn't print or return anything
                  </span>
                ) : (
                  <>
                    <span className="text-ink-label">{run.call} →</span> {run.returnValue}
                  </>
                )}
              </pre>
            )}
            {run.stderr && (
              <pre className="whitespace-pre-wrap break-words text-danger">
                {run.stderr.replace(/\n$/, "")}
              </pre>
            )}
            {run.inputNote && (
              <p className="mt-1.5 font-sans text-xs leading-normal text-ink-prose">
                <b className="mr-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-brass">
                  Note
                </b>
                input() doesn't work here: your function gets its value as an
                argument. To try a value, call it, e.g.{" "}
                <span className="font-mono text-ink">
                  {run.call ? `print(${run.call})` : "print(yourFunction(42))"}
                </span>
                .
              </p>
            )}
          </div>
        ))}

        {isRunning && (
          <div className="flex items-center gap-2 font-sans text-xs text-ink-label">
            <Loader2 className="size-3.5 animate-spin" /> Running…
          </div>
        )}
      </div>
    </section>
  );
}
