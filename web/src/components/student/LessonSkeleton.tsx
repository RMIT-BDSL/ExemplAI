/**
 * Static, JS-light skeleton of the course reader layout.
 *
 * Rendered while the Convex queries for the active lesson are still in flight.
 * Unlike a bare spinner, this paints the real three-panel frame plus a block of
 * exposition text lines, so the browser has a stable, contentful LCP element
 * immediately instead of waiting for the data round-trip.
 */
export default function LessonSkeleton() {
  return (
    <div className="dark flex h-[calc(100vh-48px)] w-full flex-col bg-[#0b0a0d] text-zinc-100 antialiased overflow-hidden">
      {/* Running Header */}
      <div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-[#09080b] px-4 flex-shrink-0 font-sans text-[10px] uppercase tracking-[0.15em] text-zinc-500 select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-400">ExemplAI</span>
          <span>·</span>
          <span>Course Reader</span>
        </div>
        <div className="h-3 w-40 rounded bg-zinc-800/80 animate-pulse" />
        <div className="h-3 w-16 rounded bg-zinc-800/60 animate-pulse" />
      </div>

      {/* Workspace Spread */}
      <div className="relative flex flex-1 flex-row overflow-hidden w-full bg-[#0b0a0d]">
        {/* Lesson index rail */}
        <div className="hidden md:flex w-12 flex-col items-center gap-4 border-r border-zinc-800 bg-[#09080b] py-4 flex-shrink-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="size-5 rounded bg-zinc-800/70 animate-pulse" />
          ))}
        </div>

        {/* Exposition column — the LCP target */}
        <div className="flex w-full max-w-[46%] flex-col gap-6 border-r border-zinc-800 bg-[#0c0b0e] px-8 py-8 flex-shrink-0">
          <div className="h-6 w-2/3 rounded bg-zinc-800/80 animate-pulse" />
          <div className="flex flex-col gap-3">
            {["w-full", "w-[92%]", "w-[97%]", "w-[85%]", "w-full", "w-[70%]"].map((w, i) => (
              <div key={i} className={`h-3.5 ${w} rounded bg-zinc-800/50 animate-pulse`} />
            ))}
          </div>
          <div className="h-24 w-full rounded bg-zinc-900 border border-zinc-800 animate-pulse" />
          <div className="flex flex-col gap-3">
            {["w-[95%]", "w-full", "w-[80%]"].map((w, i) => (
              <div key={i} className={`h-3.5 ${w} rounded bg-zinc-800/50 animate-pulse`} />
            ))}
          </div>
        </div>

        {/* Editor panel */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[#0c0b0e]">
          <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#09080b] px-4 flex-shrink-0">
            <div className="h-3 w-14 rounded bg-zinc-800/70 animate-pulse" />
            <div className="h-3 w-24 rounded bg-zinc-800/50 animate-pulse" />
          </div>
          <div className="flex-1 bg-[#0c0b0e] px-4 py-4">
            <div className="flex flex-col gap-2.5">
              {["w-[30%]", "w-[55%]", "w-[45%]", "w-[62%]", "w-[38%]", "w-[50%]"].map((w, i) => (
                <div key={i} className={`h-3 ${w} rounded bg-zinc-800/40 animate-pulse`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Running Foot */}
      <div className="flex h-8 items-center justify-between border-t border-zinc-800 bg-[#09080b] px-4 text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-sans select-none flex-shrink-0">
        <span className="text-[#c29a53] font-semibold">ExemplAI</span>
        <div className="h-3 w-20 rounded bg-zinc-800/50 animate-pulse" />
        <div className="h-3 w-24 rounded bg-zinc-800/50 animate-pulse" />
      </div>
    </div>
  );
}
