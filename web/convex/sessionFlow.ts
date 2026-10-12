// Where a student is in the study session at a given moment (convex/cohorts.ts).
// Pure, so the server (validating answers) and the page (switching screens
// when a clock runs out, which a query can't watch) agree exactly.
//
// The flow: consent → pre-survey → pre quick check → exercises → post quick
// check → post-survey → done. A student who declines goes straight to the
// exercises and skips the surveys and checks. Each quick check is untimed
// until the student presses Start, then lasts CHECK minutes or until both
// problems are submitted; the exercise clock starts when the pre check ends.
// A week with no quick-check problems skips the checks.

import type { Doc } from "./_generated/dataModel";

export type SessionStage =
  | "consent"
  | "pre_survey"
  | "pre_check"
  | "exercises"
  | "post_check"
  | "post_survey"
  | "done"
  | "open";

export type CheckPhase = "pre" | "post";

/** The moments that decide the flow; null = not known yet. */
export type Timeline = {
  preCheckEndsAt: number | null;
  exercisesStartAt: number | null;
  exercisesEndsAt: number | null;
  postCheckEndsAt: number | null;
};

export type FlowState = {
  phase: "session" | "practice";
  consented: boolean | null;
  preSurveyDone: boolean;
  postSurveyDone: boolean;
  hasChecks: boolean;
  preCheckStarted: boolean;
  postCheckStarted: boolean;
  timeline: Timeline;
};

type Participant = Pick<
  Doc<"cohortParticipants">,
  | "consented"
  | "pre_survey"
  | "post_survey"
  | "exercises_started_at"
  | "exercises_finished_at"
  | "pre_check_started_at"
  | "pre_check_finished_at"
  | "post_check_started_at"
  | "post_check_finished_at"
>;

export function timelineOf(
  p: Participant,
  opts: { hasChecks: boolean; checkMs: number; exerciseMs: number; cohortEndAt?: number },
): Timeline {
  const checks = opts.hasChecks && p.consented === true;
  const preCheckEndsAt =
    checks && p.pre_check_started_at !== undefined
      ? (p.pre_check_finished_at ?? p.pre_check_started_at + opts.checkMs)
      : null;
  // Set directly when the student declined, finished the pre check early or
  // had no checks; otherwise the pre check's time-out.
  const exercisesStartAt = p.exercises_started_at ?? preCheckEndsAt;
  const exercisesEndsAt =
    exercisesStartAt === null
      ? (opts.cohortEndAt ?? null)
      : Math.min(
          exercisesStartAt + opts.exerciseMs,
          opts.cohortEndAt ?? Number.POSITIVE_INFINITY,
          p.exercises_finished_at ?? Number.POSITIVE_INFINITY,
        );
  const postCheckEndsAt =
    checks && p.post_check_started_at !== undefined
      ? (p.post_check_finished_at ?? p.post_check_started_at + opts.checkMs)
      : null;
  return { preCheckEndsAt, exercisesStartAt, exercisesEndsAt, postCheckEndsAt };
}

export function stageAt(s: FlowState, now: number): SessionStage {
  const t = s.timeline;
  if (s.consented === null) return "consent";
  if (s.consented && !s.preSurveyDone) return "pre_survey";
  if (s.phase !== "session") return "open";
  if (s.postSurveyDone) return "done";
  const checks = s.hasChecks && s.consented;
  if (checks && (!s.preCheckStarted || (t.preCheckEndsAt !== null && now < t.preCheckEndsAt))) {
    return "pre_check";
  }
  if (t.exercisesEndsAt === null || now < t.exercisesEndsAt) return "exercises";
  if (!s.consented) return "done";
  if (checks && (!s.postCheckStarted || (t.postCheckEndsAt !== null && now < t.postCheckEndsAt))) {
    return "post_check";
  }
  return "post_survey";
}

/** The next moment the stage can change by itself (a clock running out), if any. */
export function nextDeadline(s: FlowState, now: number): number | null {
  const stage = stageAt(s, now);
  const t = s.timeline;
  if (stage === "pre_check") return s.preCheckStarted ? t.preCheckEndsAt : null;
  if (stage === "exercises") return t.exercisesEndsAt;
  if (stage === "post_check") return s.postCheckStarted ? t.postCheckEndsAt : null;
  return null;
}

/** Which form (A or B) a student takes in each check: half of each group takes A first. */
export function formFor(order: "AB" | "BA" | undefined, phase: CheckPhase): "A" | "B" {
  const o = order ?? "AB";
  return (phase === "pre" ? o[0] : o[1]) as "A" | "B";
}
