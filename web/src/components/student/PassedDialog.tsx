import { ArrowRight, Check } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Shown when a Submit passes every test, so a student who looked away (or
 * whose eyes are on the code) can't miss that it's time to move on. Stays
 * until they choose: the next exercise, or stay here. Esc stays.
 */
export default function PassedDialog({
  total,
  nextLabel,
  onNext,
  onClose,
  inSession,
}: {
  total: number;
  /** "Next exercise" or "Next lesson", matching the button under the editor. */
  nextLabel: string;
  /** Undefined on the last exercise. */
  onNext?: () => void;
  onClose: () => void;
  inSession: boolean;
}) {
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  // The parent passes a new onClose each render; Esc always uses the latest.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tests = total === 1 ? "The test passed." : `All ${total} tests passed.`;

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="passed-title"
        aria-describedby="passed-desc"
        className="w-full max-w-sm rounded-[4px] border border-rule-strong bg-surface-raised p-6 text-ink"
      >
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-7 place-items-center rounded-full bg-brass-fill text-on-brass"
            aria-hidden="true"
          >
            <Check className="size-4" />
          </span>
          <h3 id="passed-title" className="font-serif text-[1.15rem]">
            Well done, you passed
          </h3>
        </div>
        <p
          id="passed-desc"
          className="mt-3 text-xs leading-relaxed text-ink-prose"
        >
          {tests}{" "}
          {onNext
            ? `The ${nextLabel.toLowerCase()} is open.`
            : inSession
              ? "That was the last exercise. Press I'm finished at the top of the page when you're ready."
              : "That was the last one."}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          {onNext ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="h-7 rounded-[2px] border border-rule-strong px-3 text-[11px] font-medium text-ink hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
              >
                Stay here
              </button>
              <button
                ref={primaryRef}
                type="button"
                onClick={onNext}
                className="flex h-7 items-center gap-1.5 rounded-[2px] border border-brass-fill bg-brass-fill px-3 text-[11px] font-semibold tracking-[0.02em] text-on-brass transition-opacity hover:opacity-90 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
              >
                {nextLabel}
                <ArrowRight className="size-3.5" />
              </button>
            </>
          ) : (
            <button
              ref={primaryRef}
              type="button"
              onClick={onClose}
              className="h-7 rounded-[2px] border border-brass-fill bg-brass-fill px-3 text-[11px] font-semibold tracking-[0.02em] text-on-brass transition-opacity hover:opacity-90 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
