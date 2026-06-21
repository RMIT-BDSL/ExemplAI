import { query } from "./_generated/server";
import { v } from "convex/values";

// Return the last 100 tasks in a given task list.
export const getAllCourses = query({
  args: {},
  handler: async (ctx, _args) => {
    // take is not 100 - all
    const questions = await ctx.db.query("questions").withIndex("by_week").order("asc").take(100);
    return questions;
  },
});

export const getQuestionById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("questions", args.id);
    if (!id) return null;
    return await ctx.db.get(id);
  },
});
