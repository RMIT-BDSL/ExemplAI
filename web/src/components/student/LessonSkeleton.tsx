/**
 * Static, JS-light skeleton of the lesson workspace.
 *
 * Rendered while the Convex queries for the active lesson are still in flight.
 * Paints the real frame (status bar, Description · Editor · Tutor) plus a block
 * of description lines, so the browser has a stable, contentful LCP element
 * immediately instead of waiting for the data round-trip.
 */
export default function LessonSkeleton() {
  const bar = "rounded bg-rule-strong animate-pulse";
  return (
    <div className="xa-workspace flex h-dvh w-full flex-col overflow-hidden bg-surface-page text-ink antialiased">
      {/* Status bar */}
      <div className="flex h-9 flex-shrink-0 items-center justify-between border-b border-rule-strong bg-surface-void px-6">
        <div className={`h-3 w-36 ${bar}`} />
        <div className="h-[26px] w-24 rounded-full border border-rule-strong" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Description — the LCP target */}
        <div className="flex w-[clamp(240px,32%,340px)] flex-shrink-0 flex-col border-r border-rule-strong bg-surface-panel min-[1100px]:w-[340px] xl:w-[420px]">
          <div className="h-10 flex-shrink-0 border-b border-rule-strong bg-surface-void" />
          <div className="flex flex-col gap-3 px-6 py-6">
            <div className={`mb-2 h-6 w-2/3 ${bar}`} />
            {["w-full", "w-[92%]", "w-[85%]", "w-[70%]"].map((w) => (
              <div key={w} className={`h-3.5 ${w} ${bar}`} />
            ))}
            <div className="mt-4 border-t border-rule-strong pt-4">
              <div className={`h-3 w-1/2 ${bar}`} />
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex min-w-0 flex-1 flex-col bg-surface-editor">
          <div className="h-10 flex-shrink-0 border-b border-rule-strong bg-surface-void" />
          <div className="flex flex-col gap-2.5 px-6 py-4">
            {["w-[30%]", "w-[55%]", "w-[45%]", "w-[38%]"].map((w) => (
              <div key={w} className={`h-3 ${w} ${bar}`} />
            ))}
          </div>
        </div>

        {/* Tutor (rail below 1100px) */}
        <div className="w-9 flex-shrink-0 border-l border-rule-strong bg-surface-panel min-[1100px]:w-[340px] xl:w-[400px]">
          <div className="hidden h-10 border-b border-rule-strong bg-surface-void min-[1100px]:block" />
        </div>
      </div>
    </div>
  );
}
