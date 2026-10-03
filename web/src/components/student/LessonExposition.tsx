import Problem, { type LastSubmit, type ProblemData } from "./problem/Problem";

interface LessonExpositionProps {
  mappedProblem: ProblemData;
  lastSubmit?: LastSubmit;
}

/** Description column: always visible (no collapse), narrows below 1100px, one 24px left edge. */
export default function LessonExposition({
  mappedProblem,
  lastSubmit,
}: LessonExpositionProps) {
  return (
    <div className="flex w-[clamp(240px,32%,340px)] flex-shrink-0 flex-col overflow-hidden border-r border-rule-strong bg-surface-panel min-[1100px]:w-[340px] xl:w-[420px]">
      <div className="flex h-10 flex-shrink-0 items-center border-b border-rule-strong bg-surface-void px-6">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
          Description
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto editorial-scroll">
        <div className="editorial-prose px-6 py-6">
          <Problem problem={mappedProblem} lastSubmit={lastSubmit} />
        </div>
      </div>
    </div>
  );
}
