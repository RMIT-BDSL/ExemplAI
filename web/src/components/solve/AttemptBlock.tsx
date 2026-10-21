import { ChevronDown, ChevronRight, Lock, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "#/lib/utils.ts";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { diffStats, lineDiff } from "./lineDiff";

function timeOf(ms: number) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

/** One saved Run or Submit (a codeAttempts row, as convex/codeAttempts.listMine returns it). */
export type Version = FunctionReturnType<typeof api.codeAttempts.listMine>[number];

function lastLine(text: string) {
  return text.trim().split("\n").at(-1) ?? "";
}

/** One line on what came back, for the folded header. */
function summary(attempt: Version) {
  if (attempt.kind === "submit") {
    const passedAll = attempt.outcome === "passed";
    return {
      ok: passedAll,
      text: `${passedAll ? "✓" : "✗"} ${attempt.tests_passed ?? 0} of ${attempt.tests_total ?? 0} tests`,
    };
  }
  if (attempt.error_message) return { ok: false, text: lastLine(attempt.error_message) };
  if (attempt.return_value != null && attempt.return_value !== "None") {
    return { ok: null, text: `→ ${attempt.return_value}` };
  }
  return { ok: null, text: attempt.stdout ? lastLine(attempt.stdout) : "no output" };
}

const BUTTON =
  "flex h-6 items-center gap-1 rounded-[2px] px-1.5 text-[10px] font-medium tracking-[0.02em] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brass";

interface AttemptBlockProps {
  attempt: Version;
  version: number;
  /** A Run's example call, e.g. `add(1, 2)`. */
  call?: string;
  /** The attempt before this one, for "what changed". */
  previousCode?: string;
  /** Only the latest version starts unfolded. */
  defaultOpen: boolean;
  onRestore: (code: string) => void;
}

/**
 * One Run or Submit in the notebook, frozen: what came back, and on request
 * what changed since the version before. Restore puts its code back.
 */
export default function AttemptBlock({
  attempt,
  version,
  call,
  previousCode,
  defaultOpen,
  onRestore,
}: AttemptBlockProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [showChanges, setShowChanges] = useState(false);
  const diff = useMemo(
    () => (previousCode === undefined ? null : lineDiff(previousCode, attempt.code)),
    [previousCode, attempt.code],
  );
  const stats = diff ? diffStats(diff) : null;
  const changed = !stats || stats.added + stats.removed > 0;
  const { ok, text } = summary(attempt);
  // A Submit's result is already in the header; the body adds what failed.
  const hasBody = attempt.kind === "run" || !!attempt.error_message;

  return (
    <section
      aria-label={`Version ${version}`}
      className="overflow-hidden rounded-[4px] border border-rule-strong bg-surface-panel font-sans"
    >
      <header className="flex h-7 items-center gap-2 px-2 text-[10px] select-none">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-brass"
        >
          {open ? <ChevronDown className="size-3 text-ink-label" /> : <ChevronRight className="size-3 text-ink-label" />}
          <Lock className="size-3 text-ink-faint" aria-label="Saved, can't be edited" />
          <span className="font-semibold uppercase tracking-[0.15em] text-brass">v{version}</span>
          <span className="uppercase tracking-[0.15em] text-ink-label">
            {attempt.kind === "submit" ? "Submit" : "Run"} · {timeOf(attempt._creationTime)}
          </span>
          {stats && changed && (
            <span className="tabular-nums">
              <span className="text-success">+{stats.added}</span>{" "}
              <span className="text-danger">−{stats.removed}</span>
            </span>
          )}
          <span
            className={cn(
              "min-w-0 truncate font-mono text-[11px]",
              ok === true && "text-success",
              ok === false && "text-danger",
              ok === null && "text-ink-muted",
            )}
          >
            {text}
          </span>
        </button>
        {diff && changed && (
          <button
            type="button"
            onClick={() => setShowChanges(!showChanges)}
            aria-pressed={showChanges}
            className={cn(BUTTON, showChanges ? "text-brass" : "text-ink-label hover:text-ink")}
          >
            Changes
          </button>
        )}
        <button
          type="button"
          onClick={() => onRestore(attempt.code)}
          title={`Put v${version}'s code back in the editor`}
          className={cn(BUTTON, "text-ink-label hover:text-brass")}
        >
          <RotateCcw className="size-3" />
          Restore
        </button>
      </header>

      {showChanges && diff && (
        <pre className="border-t border-rule bg-surface-editor py-2 font-mono text-xs leading-[1.6]">
          {diff.map((line, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: a frozen list, never reordered
              key={i}
              className={cn(
                "px-3 whitespace-pre-wrap break-words",
                line.kind === "add" && "bg-success/10 text-success",
                line.kind === "del" && "bg-danger/10 text-danger line-through decoration-danger/40",
                line.kind === "same" && "text-ink-muted",
              )}
            >
              <span className="mr-3 inline-block w-2 select-none text-ink-faint">
                {line.kind === "add" ? "+" : line.kind === "del" ? "−" : ""}
              </span>
              {line.text || " "}
            </div>
          ))}
        </pre>
      )}

      {open && hasBody && (
        <div className="space-y-1 border-t border-rule px-3 py-2 font-mono text-xs leading-[1.6]">
          {attempt.stdout && (
            <pre className="whitespace-pre-wrap break-words text-ink">{attempt.stdout.replace(/\n$/, "")}</pre>
          )}
          {call && attempt.return_value != null && !(attempt.return_value === "None" && attempt.stdout) && (
            <pre className="whitespace-pre-wrap break-words">
              <span className="text-ink-label">{call} →</span> {attempt.return_value}
            </pre>
          )}
          {attempt.error_message && (
            <pre className="whitespace-pre-wrap break-words text-danger">{attempt.error_message.replace(/\n$/, "")}</pre>
          )}
          {attempt.kind === "run" && !attempt.stdout && !attempt.error_message && attempt.return_value == null && (
            <p className="font-sans text-ink-label">No output.</p>
          )}
        </div>
      )}
    </section>
  );
}
