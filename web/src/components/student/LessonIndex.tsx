import { ChevronLeft, Menu } from "lucide-react";

interface LessonIndexProps {
  isIndexOpen: boolean;
  setIsIndexOpen: (open: boolean) => void;
  questions: any[] | undefined;
  activeQuestionId: string | undefined;
  lessonProgress: any[] | undefined;
  onSelectLesson: (id: string) => void;
}

export default function LessonIndex({
  isIndexOpen,
  setIsIndexOpen,
  questions,
  activeQuestionId,
  lessonProgress,
  onSelectLesson,
}: LessonIndexProps) {
  if (!isIndexOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsIndexOpen(true)}
        className="border-r border-zinc-800 bg-[#0c0b0e] hover:bg-[#121115] w-9 flex flex-col items-center py-6 gap-8 transition-colors cursor-pointer text-zinc-550 hover:text-[#c29a53] flex-shrink-0 group select-none"
        title="Open Index of Lessons"
      >
        <Menu className="size-4 transition-colors group-hover:text-[#c29a53]" />
        <span
          className="text-[8px] font-semibold uppercase tracking-[0.2em] text-zinc-550 group-hover:text-[#c29a53] transition-colors"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Index of Lessons
        </span>
      </button>
    );
  }

  return (
    <div className="flex w-[260px] flex-col overflow-hidden border-r border-zinc-800 bg-[#0c0b0e] flex-shrink-0 z-30 transition-all duration-200">
      <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#09080b] px-4 flex-shrink-0">
        <span className="font-serif text-[10px] uppercase tracking-[0.15em] text-[#c29a53] font-semibold">
          Index of Lessons
        </span>
        <button
          type="button"
          onClick={() => setIsIndexOpen(false)}
          className="rounded-md p-1 text-zinc-500 hover:text-[#c29a53] transition-colors cursor-pointer"
          title="Hide Index"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-4 editorial-scroll">
        {questions?.map((q: any, idx: number) => {
          const isCurrent = q._id === activeQuestionId;
          const qProgress = lessonProgress?.find((p: any) => p.lessonId === q._id);
          const isQCompleted = qProgress?.status === "completed";
          const isQInProgress = qProgress?.status === "in-progress";

          return (
            <button
              key={q._id}
              onClick={() => onSelectLesson(q._id)}
              className="w-full text-left flex flex-col gap-1 group cursor-pointer transition-colors"
            >
              <div className="flex items-baseline justify-between w-full gap-1.5">
                <span className={`font-serif text-xs leading-tight transition-colors ${
                  isCurrent
                    ? 'text-[#c29a53] font-medium'
                    : 'text-zinc-400 group-hover:text-zinc-200'
                }`}>
                  {idx + 1}. {q.problem_name}
                </span>
                <span className="flex-1 border-b border-dotted border-zinc-850 group-hover:border-zinc-800 min-w-4 self-center" />
                <span className={`text-[8px] uppercase tracking-wider font-sans whitespace-nowrap ${
                  isQCompleted
                    ? 'text-[#4f8a65]'
                    : isQInProgress
                      ? 'text-[#c29a53]'
                      : 'text-zinc-600'
                }`}>
                  {isQCompleted ? '❖ Done' : isQInProgress ? '✦ Active' : '✧ Muted'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
