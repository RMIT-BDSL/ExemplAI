import { useEffect, useRef } from "react";

/** Confirm step for the editor header's reset wheel. Esc or Cancel keeps the code. */
export default function ResetCodeForm({
  setShowResetModal,
  handleReset,
}: {
  setShowResetModal: (showResetModal: boolean) => void;
  handleReset: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowResetModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setShowResetModal]);

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/40">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        aria-describedby="reset-desc"
        className="w-full max-w-sm rounded-[4px] border border-rule-strong bg-surface-raised p-6 text-ink"
      >
        <h3 id="reset-title" className="text-sm font-semibold">
          Reset to the starter code?
        </h3>
        <p
          id="reset-desc"
          className="mt-2 text-xs leading-relaxed text-ink-prose"
        >
          Your code for this exercise will be replaced by the starter code. This
          can't be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => setShowResetModal(false)}
            className="h-7 rounded-[2px] border border-rule-strong px-3 text-[11px] font-medium text-ink hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              handleReset();
              setShowResetModal(false);
            }}
            className="h-7 rounded-[2px] border border-danger px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-danger hover:bg-danger hover:text-surface-raised transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
