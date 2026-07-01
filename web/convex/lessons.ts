import { zid } from "convex-helpers/server/zod4";
import { zAdminMutation, zAuthenticatedQuery } from "./functions";
import { lessonFields } from "./validators";

// ---------------------------------------------------------------------------
// Lesson CRUD
//
// A "lesson" is a row in the `questions` table (the table that models lessons;
// `lessonProgress` references its rows as `lessonId`). Each lesson belongs to a
// course and carries a week, detail, and test cases.
// ---------------------------------------------------------------------------

/** Lists every lesson in a course, ordered by week (ascending). */
export const listLessonsByCourse = zAuthenticatedQuery({
  args: { course: zid("course") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("questions")
      .withIndex("by_course_week", (q) => q.eq("course", args.course))
      .collect();
  },
});

/** Fetches a single lesson by id (null if it doesn't exist). */
export const getLesson = zAuthenticatedQuery({
  args: { id: zid("questions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Creates a lesson under an existing course. Returns the new lesson id. */
export const createLesson = zAdminMutation({
  args: lessonFields,
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.course);
    if (!course) throw new Error("Course not found.");

    return await ctx.db.insert("questions", {
      ...args,
      testCases: args.testCases ?? [],
    });
  },
});

/**
 * Updates a lesson. Every field is optional; only the fields provided are
 * patched. If `course` is changed, the new course must exist.
 */
export const updateLesson = zAdminMutation({
  args: {
    id: zid("questions"),
    course: lessonFields.course.optional(),
    week: lessonFields.week.optional(),
    problem_name: lessonFields.problem_name.optional(),
    problem_description: lessonFields.problem_description.optional(),
    detail: lessonFields.detail,
    testCases: lessonFields.testCases,
    starter_code: lessonFields.starter_code,
    solution_code: lessonFields.solution_code,
  },
  handler: async (ctx, { id, ...patch }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Lesson not found.");

    if (patch.course) {
      const course = await ctx.db.get(patch.course);
      if (!course) throw new Error("Course not found.");
    }

    await ctx.db.patch(id, patch);
    return { success: true };
  },
});

/** Deletes a lesson and its students' progress rows. */
export const deleteLesson = zAdminMutation({
  args: { id: zid("questions") },
  handler: async (ctx, { id }) => {
    const progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_lesson", (q) => q.eq("lessonId", id))
      .collect();
    for (const row of progress) await ctx.db.delete(row._id);

    await ctx.db.delete(id);
    return { success: true };
  },
});
