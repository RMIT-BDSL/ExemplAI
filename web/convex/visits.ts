import { v } from "convex/values";
import { ensureCondition } from "./experiment";
import { authenticatedMutation } from "./functions";

/**
 * Time on task (research log). The workspace starts a visit each time a lesson
 * is opened and sends a heartbeat every HEARTBEAT_MS with the milliseconds the
 * student was active since the last one (tab visible and some input in the
 * last minute; src/lib/useLessonVisit.ts). Each credit is capped by the wall
 * time since the previous heartbeat plus a little slack, so a visit can never
 * gain more active time than real time passed.
 */
export const HEARTBEAT_MS = 30_000;
const SLACK_MS = 5_000;
// A remount within this window (React dev double-mount, quick reload) reuses
// the visit instead of counting a second opening.
const REUSE_WINDOW_MS = 10_000;

export function creditFor(reportedMs: number, sinceLastMs: number) {
  return Math.max(0, Math.min(reportedMs, sinceLastMs + SLACK_MS, HEARTBEAT_MS + SLACK_MS));
}

export const startVisit = authenticatedMutation({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const userId = ctx.customUser._id;
    const now = Date.now();
    const latest = await ctx.db
      .query("lessonVisits")
      .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonId", args.lessonId))
      .order("desc")
      .first();
    if (latest && latest.heartbeats === 0 && now - latest._creationTime < REUSE_WINDOW_MS) {
      return latest._id;
    }
    return await ctx.db.insert("lessonVisits", {
      userId,
      lessonId: args.lessonId,
      experiment_condition: await ensureCondition(ctx, ctx.customUser),
      active_ms: 0,
      heartbeats: 0,
      last_heartbeat_at: now,
    });
  },
});

export const heartbeat = authenticatedMutation({
  args: { visitId: v.id("lessonVisits"), activeMs: v.number() },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const visit = await ctx.db.get(args.visitId);
    if (!visit || visit.userId !== ctx.customUser._id) throw new Error("Visit not found");
    const now = Date.now();
    await ctx.db.patch(visit._id, {
      active_ms: visit.active_ms + creditFor(args.activeMs, now - visit.last_heartbeat_at),
      heartbeats: visit.heartbeats + 1,
      last_heartbeat_at: now,
    });
  },
});
