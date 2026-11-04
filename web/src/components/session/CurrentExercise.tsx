import { Navigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

/**
 * The home page during a study session's exercises: opens the student's
 * current exercise (the first open one they haven't passed) instead of the
 * syllabus, so they only ever see their exercises, one after another. Once
 * all are passed it says so and points to "I'm finished".
 */
export function CurrentExercise() {
  const lessons = useQuery(api.courses.getAllCourses);
  const progress = useQuery(api.courses.getLessonProgress, {});
  const unlocked = useQuery(api.lessonAccess.getUnlockedLessons, {});

  if (lessons === undefined || progress === undefined || unlocked === undefined) {
    return (
      <div className="xa-workspace flex min-h-dvh w-full items-center justify-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-label">
          Opening your exercises...
        </p>
      </div>
    );
  }
  const passed = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lessonId));
  const open = unlocked ? lessons.filter((l) => unlocked.includes(l._id)) : lessons;
  const current = open.find((l) => !passed.has(l._id));
  if (!current) {
    // Every exercise passed (or, misconfigured, none set): nothing to open.
    return (
      <div className="xa-workspace flex min-h-dvh w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-serif text-[1.2rem] text-ink">
          {lessons.length ? "You've finished all the exercises" : "There are no exercises to do"}
        </p>
        <p className="max-w-sm text-[13px] leading-relaxed text-ink-label">
          Press <strong>I'm finished</strong> at the top of the page to go on.
        </p>
      </div>
    );
  }
  return <Navigate to="/course" search={{ problemId: current._id }} replace />;
}
