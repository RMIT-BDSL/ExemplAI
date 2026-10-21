import { v } from "convex/values";
import { authenticatedQuery } from "./functions";

/**
 * A student's own Runs and Submits on a lesson, oldest first: the versions the
 * Solve workspace (/solve) shows between the lines of the code. Rows are
 * written by the server only (courses.recordCodeExecution), so they can't be
 * changed from the browser.
 */
export const listMine = authenticatedQuery({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, { lessonId }) => {
    const userId = ctx.customUser?._id;
    if (!userId) return [];
    const rows = await ctx.db
      .query("codeAttempts")
      .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonId", lessonId))
      .collect();
    // What the student saw, not the research fields (group, mastery, version).
    return rows.map((r) => ({
      _id: r._id,
      _creationTime: r._creationTime,
      kind: r.kind,
      code: r.code,
      outcome: r.outcome,
      tests_passed: r.tests_passed,
      tests_total: r.tests_total,
      error_message: r.error_message,
      stdout: r.stdout,
      return_value: r.return_value,
    }));
  },
});
