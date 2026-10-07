import type * as React from "react";
import Problem, { type ProblemData, type SubmitRecord } from "./problem/Problem";

interface LessonExpositionProps {
  mappedProblem: ProblemData;
  submitHistory?: SubmitRecord[];
  /** The next lesson, when it's open before this one is passed (after 3 failed Submits). */
  moveOn?: { name: string; onClick: () => void };
  /** Width set by dragging the column boundary (wide screens); default CSS width when unset. */
  width?: number;
  panelRef?: React.Ref<HTMLDivElement>;
}

/** Description column: always visible (no collapse), narrows below 1100px, one 24px left edge. */
export default function LessonExposition({
  mappedProblem,
  submitHistory,
  moveOn,
  width,
  panelRef,
}: LessonExpositionProps) {
  return (
    <div
      ref={panelRef}
      style={width ? { width } : undefined}
      className="flex w-[clamp(240px,32%,340px)] flex-shrink-0 flex-col overflow-hidden border-r border-rule-strong bg-surface-panel min-[1100px]:w-[340px] xl:w-[420px]">
      <div className="flex h-10 flex-shrink-0 items-center border-b border-rule-strong bg-surface-void px-6">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
          Description
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto editorial-scroll">
        <div className="editorial-prose px-6 py-6">
          <Problem problem={mappedProblem} submitHistory={submitHistory} moveOn={moveOn} />
        </div>
      </div>
    </div>
  );
}
