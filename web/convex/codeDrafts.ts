import { v } from "convex/values";
import { authenticatedMutation, authenticatedQuery } from "./functions";

/**
 * The code in a student's editor, saved shortly after they stop typing, so a
 * reload, a frozen or crashed browser, or a move to another computer doesn't
 * lose it (decided 2026-10-12, for the study session). The workspace prefers
 * the tab's own copy (newest) and falls back to this one, then the starter.
 */

const MAX_CODE = 50_000;

export const get = authenticatedQuery({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, { lessonId }) => {
    if (!ctx.customUser) return null;
    const row = await ctx.db
      .query("codeDrafts")
      .withIndex("by_user_lesson", (q) => q.eq("userId", ctx.customUser!._id).eq("lessonId", lessonId))
      .unique();
    return row ? { code: row.code, updated_at: row.updated_at } : null;
  },
});

export const save = authenticatedMutation({
  args: { lessonId: v.id("questions"), code: v.string() },
  handler: async (ctx, { lessonId, code }) => {
    if (!ctx.customUser) throw new Error("User not found");
    const userId = ctx.customUser._id;
    const row = await ctx.db
      .query("codeDrafts")
      .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonId", lessonId))
      .unique();
    const fields = { code: code.slice(0, MAX_CODE), updated_at: Date.now() };
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert("codeDrafts", { userId, lessonId, ...fields });
  },
});
