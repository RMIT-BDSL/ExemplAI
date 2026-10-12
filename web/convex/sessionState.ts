// A cohort student's study-session state from the database (sessionFlow.ts
// does the reasoning). Shared by convex/cohorts.ts and convex/quickChecks.ts.

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { type FlowState, timelineOf } from "./sessionFlow";
import { DEFAULT_CHECK_MINUTES, DEFAULT_EXERCISE_MINUTES, DEFAULT_SESSION_WEEK } from "./studentIds";

export function sessionWeekOf(cohort: Doc<"cohorts">) {
  return cohort.session_week ?? DEFAULT_SESSION_WEEK;
}

/** Whether the session week has quick-check problems (both forms). */
export async function weekHasChecks(ctx: QueryCtx, week: number) {
  const a = await ctx.db.query("checkProblems").withIndex("by_week_form", (q) => q.eq("week", week).eq("form", "A")).first();
  const b = await ctx.db.query("checkProblems").withIndex("by_week_form", (q) => q.eq("week", week).eq("form", "B")).first();
  return !!a && !!b;
}

export async function flowStateOf(
  ctx: QueryCtx,
  p: Doc<"cohortParticipants">,
  cohort: Doc<"cohorts">,
  user: Doc<"users">,
): Promise<FlowState> {
  const phase = user.study_phase ?? "practice";
  const hasChecks = phase === "session" && (await weekHasChecks(ctx, sessionWeekOf(cohort)));
  return {
    phase,
    consented: p.consented ?? null,
    preSurveyDone: !!p.pre_survey,
    postSurveyDone: !!p.post_survey,
    hasChecks,
    preCheckStarted: p.pre_check_started_at !== undefined,
    postCheckStarted: p.post_check_started_at !== undefined,
    timeline: timelineOf(p, {
      hasChecks,
      checkMs: (cohort.check_minutes ?? DEFAULT_CHECK_MINUTES) * 60_000,
      exerciseMs: (cohort.exercise_minutes ?? DEFAULT_EXERCISE_MINUTES) * 60_000,
      cohortEndAt: cohort.exercises_end_at,
    }),
  };
}
