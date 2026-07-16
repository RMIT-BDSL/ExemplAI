import { ChevronLeft } from "lucide-react";
import Problem from "./problem/Problem";

interface LessonExpositionProps {
  isProblemCollapsed: boolean;
  setIsProblemCollapsed: (collapsed: boolean) => void;
  mappedProblem: any;
}

export default function LessonExposition({
  isProblemCollapsed,
  setIsProblemCollapsed,
  mappedProblem,
}: LessonExpositionProps) {
  if (isProblemCollapsed) return null;

  return (
    <div className="flex flex-col overflow-hidden border-r border-zinc-800 bg-[#0c0b0e] flex-shrink-0 z-30 lg:relative lg:w-[380px] xl:w-[480px] lg:left-0 lg:top-0 lg:bottom-0 absolute left-0 top-0 bottom-0 w-[calc(100vw-20px)] md:w-[380px] transition-all duration-200">
      <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#09080b] px-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-[#c29a53] uppercase tracking-[0.15em]">
          <span>Description</span>
        </div>
        <button
          type="button"
          onClick={() => setIsProblemCollapsed(true)}
          className="rounded-md p-1 text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer"
          title="Collapse Description"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 bg-transparent editorial-scroll overflow-y-auto">
        <div className="editorial-prose px-6 py-6 h-full">
          <Problem problem={mappedProblem} />
        </div>
      </div>
    </div>
  );
}
