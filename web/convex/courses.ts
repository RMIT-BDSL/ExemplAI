import {
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { zid } from "convex-helpers/server/zod4";
import { 
  zAuthenticatedQuery, 
  zAuthenticatedMutation, 
  zAdminMutation, 
  authenticatedQuery, 
  authenticatedMutation,
  adminQuery 
} from "./functions";
import { courseFields } from "./validators";

// ---------------------------------------------------------------------------
// Course CRUD
// ---------------------------------------------------------------------------

/** Lists all courses, newest first. */
export const listCourses = zAuthenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("course").order("desc").collect();
  },
});

/** Fetches a single course by id (null if it doesn't exist). */
export const getCourse = zAuthenticatedQuery({
  args: { id: zid("course") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Creates a course. Returns the new course id. */
export const createCourse = zAdminMutation({
  args: courseFields,
  handler: async (ctx, args) => {
    return await ctx.db.insert("course", args);
  },
});

/** Updates a course's name and/or language. */
export const updateCourse = zAdminMutation({
  args: {
    id: zid("course"),
    course_name: courseFields.course_name.optional(),
    course_language: courseFields.course_language.optional(),
  },
  handler: async (ctx, { id, ...patch }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Course not found.");
    await ctx.db.patch(id, patch);
    return { success: true };
  },
});

/**
 * Deletes a course and cascades: every lesson in the course (and each
 * lesson's progress rows) is removed so nothing is left orphaned.
 */
export const deleteCourse = zAdminMutation({
  args: { id: zid("course") },
  handler: async (ctx, { id }) => {
    const lessons = await ctx.db
      .query("questions")
      .withIndex("by_course", (q) => q.eq("course", id))
      .collect();

    for (const lesson of lessons) {
      const progress = await ctx.db
        .query("lessonProgress")
        .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
        .collect();
      for (const row of progress) await ctx.db.delete(row._id);
      await ctx.db.delete(lesson._id);
    }

    await ctx.db.delete(id);
    return { success: true };
  },
});

// Return the last 100 tasks in a given task list.
export const getAllCourses = authenticatedQuery({
  args: {},
  handler: async (ctx, _args) => {
    // take is not 100 - all
    const questions = await ctx.db.query("questions").withIndex("by_week").order("asc").take(100);
    return questions;
  },
});

export const getQuestionById = authenticatedQuery({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("questions", args.id);
    if (!id) return null;
    return await ctx.db.get(id);
  },
});

/**
 * Resolves a student's `users` row from their tokenIdentifier
 * (i.e. session.user.id on the frontend).
 */
async function getUserByToken(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string,
) {
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
}

/**
 * Returns a student's progress for every lesson they've started or completed.
 * Each entry is { lessonId, status }. Lessons not present are "pending".
 */
export const getLessonProgress = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getUserByToken(ctx, ctx.user._id);
    if (!user) return [];

    const rows = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return rows.map((row) => ({ lessonId: row.lessonId, status: row.status }));
  },
});

/**
 * Sets a student's status for a single lesson.
 * - "in-progress" / "completed": creates or updates the progress row.
 * - "pending": removes the row (the UI default for lessons with no record).
 * Looked up via the by_user_lesson index so it's a single-row upsert.
 */
export const setLessonStatus = authenticatedMutation({
  args: {
    lessonId: v.id("questions"),
    status: v.union(
      v.literal("in-progress"),
      v.literal("completed"),
      v.literal("pending"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getUserByToken(ctx, ctx.user._id);
    if (!user) {
      throw new Error("Student not found.");
    }

    const existing = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", user._id).eq("lessonId", args.lessonId),
      )
      .unique();

    if (args.status === "pending") {
      if (existing) await ctx.db.delete(existing._id);
      return { success: true };
    }

    // Marking a lesson "in-progress" must never undo a "completed" lesson
    // (e.g. when a finished problem is reopened for review).
    if (
      args.status === "in-progress" &&
      existing?.status === "completed"
    ) {
      return { success: true };
    }

    if (existing) {
      await ctx.db.patch(existing._id, { status: args.status });
    } else {
      await ctx.db.insert("lessonProgress", {
        userId: user._id,
        lessonId: args.lessonId,
        status: args.status,
      });
    }

    return { success: true };
  },
});

/**
 * Admin view: how many students are in-progress vs completed for a lesson.
 * Uses the by_lesson index so it scans only this lesson's progress rows.
 */
export const getLessonCompletionStats = adminQuery({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("lessonProgress")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();

    return {
      inProgress: rows.filter((r) => r.status === "in-progress").length,
      completed: rows.filter((r) => r.status === "completed").length,
    };
  },
});
