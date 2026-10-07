import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authenticatedQuery } from "./functions";
import { isStudent } from "./studentMetrics";

/**
 * Lesson order and unlocks. Lessons are ordered by week, then position. Within
 * each week they unlock one at a time: the week's first lesson is always open,
 * and each later one opens once the lesson before it is completed (passed).
 * A lesson the student has already started or completed stays open, even if
 * the order changes later. Other lessons show their name only.
 *
 * Every week's first lesson is open, so a session can start on any week's topic.
 * Staff (admin or management role, on the login account or the user row) see
 * and open every lesson; staff testing can also turn locks off for everyone
 * with the Convex environment variable LESSON_LOCKS=off.
 */

type Orderable = Pick<Doc<"questions">, "week" | "position" | "_creationTime">;

export function inLessonOrder<T extends Orderable>(lessons: T[]): T[] {
  return [...lessons].sort(
    (a, b) =>
      a.week - b.week ||
      (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
      a._creationTime - b._creationTime,
  );
}

export function lessonLocksEnabled() {
  return process.env.LESSON_LOCKS !== "off";
}

/** The lessons a student may open, given their progress rows. */
export function unlockedLessons(
  lessons: (Orderable & { _id: Id<"questions"> })[],
  progress: Pick<Doc<"lessonProgress">, "lessonId" | "status">[],
): Set<Id<"questions">> {
  const status = new Map(progress.map((p) => [p.lessonId, p.status]));
  const open = new Set<Id<"questions">>();
  let previous: { week: number; completed: boolean } | null = null;
  for (const lesson of inLessonOrder(lessons)) {
    const firstOfWeek = previous === null || previous.week !== lesson.week;
    if (firstOfWeek || previous?.completed || status.has(lesson._id)) open.add(lesson._id);
    previous = { week: lesson.week, completed: status.get(lesson._id) === "completed" };
  }
  return open;
}

/** Staff are never locked; `isAdmin` is the auth helpers' ctx.isAdmin. */
export function bypassesLocks(user: Pick<Doc<"users">, "role"> | null, isAdmin: boolean) {
  return !lessonLocksEnabled() || isAdmin || (user !== null && !isStudent(user));
}

/** Whether this user may open this lesson (always, for staff or with locks off). */
export async function canOpenLesson(
  ctx: QueryCtx,
  user: Doc<"users">,
  lessonId: Id<"questions">,
  isAdmin: boolean,
): Promise<boolean> {
  if (bypassesLocks(user, isAdmin)) return true;
  const lesson = await ctx.db.get(lessonId);
  if (!lesson) return false;
  const week = await ctx.db
    .query("questions")
    .withIndex("by_course_week", (q) => q.eq("course", lesson.course).eq("week", lesson.week))
    .collect();
  const progress = await ctx.db
    .query("lessonProgress")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  return unlockedLessons(week, progress).has(lessonId);
}

// Which lessons the student can open (null = every lesson: staff, or locks off).
export const getUnlockedLessons = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    if (!ctx.customUser || bypassesLocks(ctx.customUser, ctx.isAdmin)) return null;
    const userId = ctx.customUser._id;
    const lessons = await ctx.db.query("questions").collect();
    const progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return [...unlockedLessons(lessons, progress)];
  },
});

