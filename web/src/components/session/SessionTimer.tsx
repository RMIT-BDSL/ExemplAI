import { useMutation } from "convex/react";
import { useState } from "react";
import { cn } from "#/lib/utils";
import { api } from "../../../convex/_generated/api";

const WARN_MS = 5 * 60_000;

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Time left for the session's exercises, pinned to the middle of the top bar
 * (both the syllabus navbar and the workspace status bar leave it free), with
 * "I'm finished". While testing (CONDITION_TOGGLE=on) it also shows the
 * student's group.
 */
export function SessionTimer({
  msLeft,
  hasChecks,
  testingGroup,
}: {
  msLeft: number;
  /** Two more short problems come after the exercises. */
  hasChecks: boolean;
  testingGroup: string | null;
}) {
  const finish = useMutation(api.cohorts.finishExercises);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const warn = msLeft <= WARN_MS;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center">
      <div className="pointer-events-auto relative flex h-9 items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.12em]">
        <span
          className={cn(
            "tabular-nums",
            warn ? "text-danger" : "text-ink-label",
          )}
          title={
            warn
              ? "Finish the exercise you're on; the feedback survey opens when time is up"
              : undefined
          }
        >
          {clock(msLeft)} left{warn && " · wrap up"}
        </span>
        <button
          type="button"
          onClick={() => setConfirming((c) => !c)}
          className="rounded-[2px] border border-rule-strong px-2 py-1 text-ink-muted hover:text-brass cursor-pointer focus-visible:outline-2 focus-visible:outline-brass"
        >
          I'm finished
        </button>
        {testingGroup && (
          <span
            className="rounded-[2px] border border-dashed border-brass px-2 py-1 text-brass"
            title="Shown only while testing (CONDITION_TOGGLE=on)"
          >
            Test · {testingGroup}
          </span>
        )}

        {confirming && (
          <div
            role="dialog"
            aria-label="Finish the exercises"
            className="absolute left-1/2 top-10 w-72 -translate-x-1/2 rounded-[4px] border border-rule-strong bg-surface-panel p-4 normal-case tracking-normal shadow-lg"
          >
            <p className="mb-3 text-xs font-normal leading-relaxed text-ink">
              {hasChecks
                ? "Finish the exercises and go on to two more short problems and the feedback survey? You can't come back to the exercises after this."
                : "Finish the exercises and go to the short feedback survey? You can't come back to the exercises after this."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await finish({});
                  } finally {
                    setBusy(false);
                  }
                }}
                className="h-8 rounded-[2px] border border-brass-fill bg-brass-fill px-3 text-xs font-semibold text-on-brass hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                Yes, I'm finished
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-8 rounded-[2px] border border-rule-strong px-3 text-xs font-semibold text-ink hover:bg-surface-raised cursor-pointer"
              >
                Keep working
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
