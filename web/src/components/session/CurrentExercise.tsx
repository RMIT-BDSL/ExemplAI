import { Navigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

/**
 * The home page during a study session's exercises: opens the student's
 * current exercise (the first open one they haven't passed) instead of the
 * syllabus, so they only ever see their exercises, one after another.
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
  const current = open.find((l) => !passed.has(l._id)) ?? open.at(-1) ?? lessons[0];
  if (!current) return null;
  return <Navigate to="/course" search={{ problemId: current._id }} replace />;
}
