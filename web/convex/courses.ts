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
 * Each entry is { lessonId, status, has_run, bkt_recorded }.
 * Lessons not present are "pending".
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

    return rows.map((row) => ({
      lessonId: row.lessonId,
      status: row.status,
      has_run: row.has_run ?? false,
      bkt_recorded: row.bkt_recorded ?? false,
      failed_submits: row.failed_submits ?? 0,
    }));
  },
});

/**
 * Context for the FastAPI BKT engine after Judge0: lesson KC, whether this
 * lesson already contributed a BKT observation, and current mastery (if any).
 * BKT math lives on the Python server — Convex only stores the result.
 */
export const getExecutionBktContext = authenticatedQuery({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, args) => {
    const user = await getUserByToken(ctx, ctx.user._id);
    if (!user) return null;

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) return null;

    const progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", user._id).eq("lessonId", args.lessonId),
      )
      .unique();

    const kc = lesson.knowledge_component ?? null;
    let probMastery: number | null = null;
    if (kc) {
      const mastery = await ctx.db
        .query("bktMastery")
        .withIndex("by_user_kc", (q) =>
          q.eq("userId", user._id).eq("knowledge_component", kc),
        )
        .unique();
      probMastery = mastery?.prob_mastery ?? null;
    }

    return {
      knowledge_component: kc,
      bkt_recorded: progress?.bkt_recorded ?? false,
      has_run: progress?.has_run ?? false,
      status: progress?.status ?? null,
      prob_mastery: probMastery,
    };
  },
});

/**
 * Marks a lesson the student opened as "in-progress" (creating its progress
 * row). That is the only status a student may set: completion and failed
 * Submits are recorded by recordCodeExecution with the backend secret, and
 * students can't clear a row, which would wipe its failed Submits and let a
 * retry count as a first-try pass. A completed lesson stays completed.
 */
export const setLessonStatus = authenticatedMutation({
  args: {
    lessonId: v.id("questions"),
    status: v.literal("in-progress"),
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

    // Reopening a finished lesson for review leaves it completed.
    if (existing?.status === "completed") {
      return { success: true };
    }

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { updated_at: now });
    } else {
      await ctx.db.insert("lessonProgress", {
        userId: user._id,
        lessonId: args.lessonId,
        status: args.status,
        updated_at: now,
      });
    }

    return { success: true };
  },
});

/**
 * Called by the FastAPI /execute path (with the student's JWT) after Judge0
 * finishes. Always sets has_run. On first Submit, persists server-computed
 * BKT mastery (Python) when probMastery + knowledgeComponent are provided.
 * Requires the backend secret: the student holds the same JWT, and every
 * argument here (pass/fail, mastery) must come from the server, not them.
 */
export const recordCodeExecution = authenticatedMutation({
  args: {
    lessonId: v.id("questions"),
    passed: v.boolean(),
    actionType: v.union(v.literal("run"), v.literal("submit")),
    // Server-computed mastery after first Submit; omit on run / re-submit.
    probMastery: v.optional(v.number()),
    // Mastery the server updated from (stored value or BKT prior).
    priorMastery: v.optional(v.number()),
    knowledgeComponent: v.optional(v.string()),
    // Server-computed: probMastery reached the BKT mastery threshold.
    mastered: v.optional(v.boolean()),
    // Server-built summary of a failed Submit (hidden tests counted only).
    errorTrace: v.optional(v.string()),
    backendSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!process.env.CONVEX_BACKEND_SECRET || args.backendSecret !== process.env.CONVEX_BACKEND_SECRET) {
      throw new Error("Unauthorized: Invalid backend secret");
    }
    const user = await getUserByToken(ctx, ctx.user._id);
    if (!user) {
      throw new Error("Student not found.");
    }

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new Error("Lesson not found.");
    }

    const existing = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", user._id).eq("lessonId", args.lessonId),
      )
      .unique();

    const alreadyCompleted = existing?.status === "completed";
    const nextStatus =
      args.actionType === "submit" && args.passed
        ? ("completed" as const)
        : alreadyCompleted
          ? ("completed" as const)
          : ("in-progress" as const);

    const shouldRecordBkt =
      args.actionType === "submit" &&
      !existing?.bkt_recorded &&
      args.probMastery !== undefined &&
      !!args.knowledgeComponent;

    let bktRecorded = existing?.bkt_recorded ?? false;
    let probMastery: number | undefined;
    let knowledgeComponent: string | undefined;
    let mastered: boolean | undefined;

    const now = Date.now();
    if (shouldRecordBkt) {
      knowledgeComponent = args.knowledgeComponent!;
      probMastery = Math.min(1, Math.max(0, args.probMastery!));

      const masteryRow = await ctx.db
        .query("bktMastery")
        .withIndex("by_user_kc", (q) =>
          q
            .eq("userId", user._id)
            .eq("knowledge_component", knowledgeComponent!),
        )
        .unique();

      // Sticky: once mastered, a later fail doesn't revoke it.
      const newlyMastered = !masteryRow?.mastered && args.mastered === true;
      mastered = masteryRow?.mastered === true || newlyMastered;

      if (masteryRow) {
        await ctx.db.patch(masteryRow._id, {
          prob_mastery: probMastery,
          updatedAt: now,
          ...(newlyMastered ? { mastered: true, masteredAt: now } : {}),
        });
      } else {
        await ctx.db.insert("bktMastery", {
          userId: user._id,
          knowledge_component: knowledgeComponent,
          prob_mastery: probMastery,
          updatedAt: now,
          mastered,
          ...(newlyMastered ? { masteredAt: now } : {}),
        });
      }
      bktRecorded = true;
    }

    // A failed Submit (not Run) unlocks "Get help" and is what the tutor
    // sees as the error.
    const failedSubmit = args.actionType === "submit" && !args.passed;
    const failedSubmits = (existing?.failed_submits ?? 0) + (failedSubmit ? 1 : 0);
    // round_failed_submits earns examples in the current round (convex/examples.ts).
    const failureFields = failedSubmit
      ? {
          failed_submits: failedSubmits,
          round_failed_submits: (existing?.round_failed_submits ?? existing?.failed_submits ?? 0) + 1,
          last_error_trace: args.errorTrace ?? "",
        }
      : {};

    const activityFields = {
      updated_at: now,
      ...(args.actionType === "submit" ? { last_submit_at: now } : {}),
      ...(nextStatus === "completed" && !alreadyCompleted ? { completed_at: now } : {}),
      ...(shouldRecordBkt && args.priorMastery !== undefined
        ? { mastery_before: Math.min(1, Math.max(0, args.priorMastery)) }
        : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: nextStatus,
        has_run: true,
        ...(bktRecorded ? { bkt_recorded: true } : {}),
        ...failureFields,
        ...activityFields,
      });
    } else {
      await ctx.db.insert("lessonProgress", {
        userId: user._id,
        lessonId: args.lessonId,
        status: nextStatus,
        has_run: true,
        ...(bktRecorded ? { bkt_recorded: true } : {}),
        ...failureFields,
        ...activityFields,
      });
    }

    return {
      has_run: true,
      bkt_recorded: bktRecorded,
      status: nextStatus,
      prob_mastery: probMastery,
      knowledge_component: knowledgeComponent,
      mastered,
      failed_submits: failedSubmits,
    };
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
