import { Link } from "@tanstack/react-router";
import { ChevronLeft, Lock, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

interface LessonIndexProps {
  isIndexOpen: boolean;
  setIsIndexOpen: (open: boolean) => void;
  questions: any[] | undefined;
  activeQuestionId: string | undefined;
  lessonProgress: any[] | undefined;
  /** Lessons the student may open; null/undefined = all (convex/lessonAccess.ts). */
  unlocked: Set<string> | null | undefined;
  /** Side effects to run when a lesson is picked (navigation is handled by the Link). */
  onSelectLesson: (id: string) => void;
}

/**
 * Lesson index drawer, opened from the status bar's "Week N · Topic" button.
 * Lists the whole course grouped by week (book-style, dotted leaders) and
 * scrolls the current lesson into view. Closes on Esc, backdrop click or pick.
 */
export default function LessonIndex({
  isIndexOpen,
  setIsIndexOpen,
  questions,
  activeQuestionId,
  lessonProgress,
  unlocked,
  onSelectLesson,
}: LessonIndexProps) {
  const currentRef = useRef<HTMLAnchorElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const weeks = useMemo(() => {
    const groups = new Map<number, any[]>();
    for (const q of questions ?? []) {
      const list = groups.get(q.week) ?? [];
      list.push(q);
      groups.set(q.week, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [questions]);

  useEffect(() => {
    if (!isIndexOpen) return;
    currentRef.current?.scrollIntoView({ block: "center" });
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsIndexOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isIndexOpen, setIsIndexOpen]);

  if (!isIndexOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        id="lesson-index"
        role="dialog"
        aria-modal="true"
        aria-label="Lesson index"
        className="flex h-full w-[340px] max-w-[calc(100vw-48px)] flex-col border-r border-rule-strong bg-surface-panel"
      >
        <div className="flex h-9 flex-shrink-0 items-center justify-between border-b border-rule-strong bg-surface-void px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-ink-label hover:text-brass transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Syllabus
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setIsIndexOpen(false)}
            aria-label="Close lesson index"
            className="grid size-6 place-items-center rounded-[2px] text-ink-label hover:text-brass transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brass"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-6 py-6 editorial-scroll">
          {weeks.map(([week, lessons]) => (
            <section key={week} className="mb-6">
              <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
                Week {week}
                {lessons[0]?.topic ? (
                  <span className="font-medium text-ink-label">
                    {" "}
                    · {lessons[0].topic}
                  </span>
                ) : null}
              </h2>
              <ul>
                {lessons.map((q: any) => {
                  const isCurrent = q._id === activeQuestionId;
                  const progress = lessonProgress?.find(
                    (p: any) => p.lessonId === q._id,
                  );
                  const isDone = progress?.status === "completed";
                  const isStarted = progress?.status === "in-progress";
                  if (unlocked && !unlocked.has(q._id) && !isCurrent) {
                    return (
                      <li
                        key={q._id}
                        title="Unlocks when you complete the exercise before it"
                        className="flex items-baseline gap-1.5 py-1.5 font-serif text-[13px] text-ink-label"
                      >
                        <span>{q.problem_name}</span>
                        <span className="min-w-4 flex-1 self-center border-b border-dotted border-rule" />
                        <Lock className="size-3 self-center" aria-label="Locked" />
                      </li>
                    );
                  }
                  return (
                    <li key={q._id}>
                      <Link
                        ref={isCurrent ? currentRef : undefined}
                        to="/course"
                        search={{ problemId: q._id }}
                        onClick={() => {
                          onSelectLesson(q._id);
                          setIsIndexOpen(false);
                        }}
                        aria-current={isCurrent ? "page" : undefined}
                        className="group flex items-baseline gap-1.5 py-1.5 font-serif text-[13px]"
                      >
                        <span
                          className={
                            isCurrent
                              ? "text-brass"
                              : "text-ink-prose group-hover:text-ink transition-colors"
                          }
                        >
                          {q.problem_name}
                        </span>
                        <span className="min-w-4 flex-1 self-center border-b border-dotted border-rule-strong" />
                        <span
                          className={`whitespace-nowrap font-sans text-[9px] font-medium uppercase tracking-[0.1em] ${
                            isCurrent
                              ? "text-brass"
                              : isDone
                                ? "text-success"
                                : "text-ink-label"
                          }`}
                        >
                          {isCurrent
                            ? "Current"
                            : isDone
                              ? "✓ Done"
                              : isStarted
                                ? "Started"
                                : ""}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </div>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close lesson index"
        tabIndex={-1}
        onClick={() => setIsIndexOpen(false)}
        className="flex-1 cursor-default bg-black/25"
      />
    </div>
  );
}
