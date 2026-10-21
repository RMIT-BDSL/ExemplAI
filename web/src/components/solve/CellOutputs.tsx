import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { AccuracyNotice, MessageBubble, TutorProgress } from "#/components/student/problem/ChatBox";
import { cn } from "#/lib/utils.ts";
import { type FoldAll, useFold } from "./fold";
import { type DiffLine, diffStats, lineDiff } from "./lineDiff";
import type { RunOutput, SubmitOutput, TutorOutput } from "./notebook";

function timeOf(ms: number) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

function lastLine(text: string) {
  return text.trim().split("\n").at(-1) ?? "";
}

// Lines of context kept around each change.
const CONTEXT = 1;

/** The changed lines with a little context; runs of unchanged lines become a count. */
function hunks(diff: DiffLine[]) {
  const keep = diff.map(() => false);
  diff.forEach((line, i) => {
    if (line.kind === "same") return;
    for (let j = Math.max(0, i - CONTEXT); j <= Math.min(diff.length - 1, i + CONTEXT); j++) keep[j] = true;
  });
  const out: (DiffLine | { skipped: number })[] = [];
  let skipped = 0;
  diff.forEach((line, i) => {
    if (keep[i]) {
      if (skipped) out.push({ skipped });
      skipped = 0;
      out.push(line);
    } else skipped++;
  });
  if (skipped) out.push({ skipped });
  return out;
}

/** What changed between two versions of some code (only the changed parts). */
function Changes({ diff }: { diff: DiffLine[] }) {
  return (
    <pre className="border-t border-rule bg-surface-editor py-2 font-mono text-xs leading-[1.6]">
      {hunks(diff).map((line, i) =>
        "skipped" in line ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: a frozen list, never reordered
          <div key={i} className="px-3 font-sans text-[10px] text-ink-faint select-none">
            ⋯ {line.skipped} unchanged {line.skipped === 1 ? "line" : "lines"}
          </div>
        ) : (
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
        ),
      )}
    </pre>
  );
}

/** The frame every output shares: a header that folds it, then its body. */
function OutputFrame({
  label,
  time,
  stats,
  summary,
  tone,
  actions,
  open,
  setOpen,
  children,
}: {
  label: string;
  time: number;
  stats?: { added: number; removed: number } | null;
  summary?: string;
  tone?: "ok" | "bad" | null;
  actions?: ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[4px] border border-rule-strong bg-surface-panel font-sans">
      <header className="flex h-7 items-center gap-2 px-2 text-[10px] select-none">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-brass"
        >
          {open ? <ChevronDown className="size-3 text-ink-label" /> : <ChevronRight className="size-3 text-ink-label" />}
          <Lock className="size-3 text-ink-faint" aria-label="Saved output" />
          <span className="font-semibold uppercase tracking-[0.15em] text-brass">{label}</span>
          <span className="uppercase tracking-[0.15em] text-ink-label">{timeOf(time)}</span>
          {stats && stats.added + stats.removed > 0 && (
            <span className="tabular-nums">
              <span className="text-success">+{stats.added}</span>{" "}
              <span className="text-danger">−{stats.removed}</span>
            </span>
          )}
          {summary && (
            <span
              className={cn(
                "min-w-0 truncate font-mono text-[11px]",
                tone === "ok" ? "text-success" : tone === "bad" ? "text-danger" : "text-ink-muted",
              )}
            >
              {summary}
            </span>
          )}
        </button>
        {actions}
      </header>
      {open && children}
    </section>
  );
}

const TOGGLE =
  "flex h-6 items-center rounded-[2px] px-1.5 text-[10px] font-medium tracking-[0.02em] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brass";

function ChangesToggle({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={shown}
      className={cn(TOGGLE, shown ? "text-brass" : "text-ink-label hover:text-ink")}
    >
      Changes
    </button>
  );
}

/** A code cell's last run: what it printed, and what changed in the cell since the run before. */
export function RunOutputBlock({ output, foldAll }: { output: RunOutput; foldAll: FoldAll }) {
  const [open, setOpen] = useFold(true, foldAll);
  const [showChanges, setShowChanges] = useState(false);
  const diff = useMemo(
    () => (output.prev_source === undefined ? null : lineDiff(output.prev_source, output.source)),
    [output.prev_source, output.source],
  );
  const stats = diff && diffStats(diff);
  const changed = !!stats && stats.added + stats.removed > 0;
  const summary = output.error
    ? lastLine(output.error)
    : output.return_value != null && output.return_value !== "None"
      ? `→ ${output.return_value}`
      : output.stdout
        ? lastLine(output.stdout)
        : "no output";

  return (
    <OutputFrame
      label="Run"
      time={output.at}
      stats={stats}
      summary={summary}
      tone={output.error ? "bad" : null}
      open={open}
      setOpen={setOpen}
      actions={open && changed && <ChangesToggle shown={showChanges} onClick={() => setShowChanges(!showChanges)} />}
    >
      {showChanges && diff && changed && <Changes diff={diff} />}
      <div className="space-y-1 border-t border-rule px-3 py-2 font-mono text-xs leading-[1.6]">
        {output.stdout && (
          <pre className="whitespace-pre-wrap break-words text-ink">{output.stdout.replace(/\n$/, "")}</pre>
        )}
        {output.call && output.return_value != null && !(output.return_value === "None" && output.stdout) && (
          <pre className="whitespace-pre-wrap break-words text-ink">
            <span className="text-ink-label">{output.call} →</span> {output.return_value}
          </pre>
        )}
        {output.error && (
          <pre className="whitespace-pre-wrap break-words text-danger">{output.error.replace(/\n$/, "")}</pre>
        )}
        {!output.stdout && !output.error && output.return_value == null && (
          <p className="font-sans text-ink-label">No output.</p>
        )}
      </div>
    </OutputFrame>
  );
}

/** A markdown cell's question to the tutor and the reply. */
export function TutorOutputBlock({
  output,
  notice,
  progress,
  foldAll,
}: {
  output: TutorOutput;
  /** The first reply in the notebook carries the AI-accuracy notice the ethics approval requires. */
  notice: boolean;
  /** Steps of the reply being written, while waiting. */
  progress: { steps: string[]; forExample: boolean } | null;
  foldAll: FoldAll;
}) {
  const [open, setOpen] = useFold(true, foldAll);
  const summary =
    output.status === "waiting"
      ? "writing a reply…"
      : output.status === "done"
        ? lastLine(output.reply ?? "")
        : (output.note ?? "");

  return (
    <OutputFrame
      label={output.reply_type === "new_example" ? "Tutor · Example" : "Tutor"}
      time={output.at}
      summary={open ? undefined : summary}
      tone={output.status === "error" ? "bad" : null}
      open={open}
      setOpen={setOpen}
    >
      <div className="space-y-3 border-t border-rule px-4 py-3">
        {notice && <AccuracyNotice />}
        {output.status === "waiting" && progress && (
          <TutorProgress steps={progress.steps} forExample={progress.forExample} />
        )}
        {output.status === "done" && output.reply && (
          <div className="editorial-chat-container">
            <MessageBubble
              message={{
                id: output.message_id ?? "reply",
                sender: "assistant",
                content: output.reply,
                timestamp: new Date(output.at),
                responseType: output.reply_type,
              }}
            />
          </div>
        )}
        {(output.status === "locked" || output.status === "error") && (
          <p className={cn("font-sans text-xs", output.status === "error" ? "text-danger" : "text-ink-label")}>
            {output.note}
          </p>
        )}
      </div>
    </OutputFrame>
  );
}

/** The last Submit of the whole notebook: the grade, and what changed since the Submit before. */
export function SubmitBlock({ submit, foldAll }: { submit: SubmitOutput; foldAll: FoldAll }) {
  const [open, setOpen] = useFold(true, foldAll);
  const [showChanges, setShowChanges] = useState(false);
  const diff = useMemo(
    () => (submit.prev_code === undefined ? null : lineDiff(submit.prev_code, submit.code)),
    [submit.prev_code, submit.code],
  );
  const stats = diff && diffStats(diff);
  const changed = !!stats && stats.added + stats.removed > 0;
  const ok = submit.outcome === "passed";
  return (
    <OutputFrame
      label="Submit"
      time={submit.at}
      stats={stats}
      summary={
        submit.outcome === "error" ? "couldn't grade" : `${ok ? "✓" : "✗"} ${submit.passed} of ${submit.total} tests`
      }
      tone={ok ? "ok" : "bad"}
      open={open}
      setOpen={setOpen}
      actions={open && changed && <ChangesToggle shown={showChanges} onClick={() => setShowChanges(!showChanges)} />}
    >
      {showChanges && diff && changed && <Changes diff={diff} />}
      {submit.error && (
        <pre className="whitespace-pre-wrap break-words border-t border-rule px-3 py-2 font-mono text-xs leading-[1.6] text-danger">
          {submit.error.replace(/\n$/, "")}
        </pre>
      )}
      {!submit.error && (
        <p className="border-t border-rule px-3 py-2 font-sans text-xs text-ink-label">
          {ok ? "Every test passed." : "Some tests didn't pass."}
        </p>
      )}
    </OutputFrame>
  );
}
