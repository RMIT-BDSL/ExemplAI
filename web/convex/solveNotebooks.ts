import { v } from "convex/values";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { notebookCell, notebookSubmit } from "./schema";

/**
 * A student's Solve notebook for a lesson (/solve): code and markdown cells
 * with their last outputs, saved shortly after they stop typing, like
 * codeDrafts. Only the student reads or writes their own.
 */

// Room for a long session of cells and outputs, not for anything else.
const MAX_CELLS = 200;
const MAX_CHARS = 300_000;

export const get = authenticatedQuery({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, { lessonId }) => {
    const userId = ctx.customUser?._id;
    if (!userId) return null;
    const row = await ctx.db
      .query("solveNotebooks")
      .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonId", lessonId))
      .unique();
    return row ? { cells: row.cells, submit: row.submit ?? null, updated_at: row.updated_at } : null;
  },
});

export const save = authenticatedMutation({
  args: {
    lessonId: v.id("questions"),
    cells: v.array(notebookCell),
    submit: v.optional(notebookSubmit),
  },
  handler: async (ctx, { lessonId, cells, submit }) => {
    if (!ctx.customUser) throw new Error("User not found");
    if (cells.length > MAX_CELLS) throw new Error(`A notebook can have at most ${MAX_CELLS} cells.`);
    if (JSON.stringify({ cells, submit }).length > MAX_CHARS) throw new Error("This notebook is too large to save.");
    const userId = ctx.customUser._id;
    const row = await ctx.db
      .query("solveNotebooks")
      .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonId", lessonId))
      .unique();
    const fields = { cells, submit, updated_at: Date.now() };
    if (row) await ctx.db.replace(row._id, { userId, lessonId, ...fields });
    else await ctx.db.insert("solveNotebooks", { userId, lessonId, ...fields });
  },
});
