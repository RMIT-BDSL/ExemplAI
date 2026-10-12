import { describe, expect, it } from "vitest";
import { type FlowState, formFor, nextDeadline, stageAt, timelineOf } from "../convex/sessionFlow";

const MIN = 60_000;
const opts = { hasChecks: true, checkMs: 5 * MIN, exerciseMs: 35 * MIN };

function state(p: Parameters<typeof timelineOf>[0], extra: Partial<FlowState> = {}, o = opts): FlowState {
  return {
    phase: "session",
    consented: p.consented ?? null,
    preSurveyDone: !!p.pre_survey,
    postSurveyDone: !!p.post_survey,
    hasChecks: o.hasChecks,
    preCheckStarted: p.pre_check_started_at !== undefined,
    postCheckStarted: p.post_check_started_at !== undefined,
    timeline: timelineOf(p, o),
    ...extra,
  };
}

const answered = { consented: true, pre_survey: { a: "1" } } as const;

describe("session flow", () => {
  it("starts with consent, then the pre-survey", () => {
    expect(stageAt(state({}), 0)).toBe("consent");
    expect(stageAt(state({ consented: true }), 0)).toBe("pre_survey");
  });

  it("waits on the quick-check intro (untimed) until Start", () => {
    const s = state(answered);
    expect(stageAt(s, 10 * MIN)).toBe("pre_check");
    expect(nextDeadline(s, 10 * MIN)).toBeNull();
  });

  it("runs the pre check for 5 minutes, then 35 minutes of exercises", () => {
    const s = state({ ...answered, pre_check_started_at: 0 });
    expect(stageAt(s, 4 * MIN)).toBe("pre_check");
    expect(stageAt(s, 5 * MIN)).toBe("exercises");
    expect(nextDeadline(s, 6 * MIN)).toBe(40 * MIN);
    expect(stageAt(s, 40 * MIN)).toBe("post_check");
  });

  it("starts the exercise clock when the pre check finishes early", () => {
    const s = state({ ...answered, pre_check_started_at: 0, pre_check_finished_at: 2 * MIN, exercises_started_at: 2 * MIN });
    expect(stageAt(s, 3 * MIN)).toBe("exercises");
    expect(s.timeline.exercisesEndsAt).toBe(37 * MIN);
  });

  it("gives the post check its own 5 minutes, then the post-survey", () => {
    const p = { ...answered, pre_check_started_at: 0, post_check_started_at: 41 * MIN };
    expect(stageAt(state(p), 45 * MIN)).toBe("post_check");
    expect(stageAt(state(p), 46 * MIN)).toBe("post_survey");
    expect(stageAt(state({ ...p, post_check_finished_at: 42 * MIN }), 43 * MIN)).toBe("post_survey");
  });

  it("ends the exercises early on 'I'm finished' or the cohort's end-now", () => {
    const p = { ...answered, pre_check_started_at: 0 };
    expect(stageAt(state({ ...p, exercises_finished_at: 10 * MIN }), 11 * MIN)).toBe("post_check");
    expect(stageAt(state(p, {}, { ...opts, cohortEndAt: 20 * MIN } as typeof opts), 21 * MIN)).toBe("post_check");
  });

  it("skips the checks when the week has none", () => {
    const o = { ...opts, hasChecks: false };
    const s = state({ ...answered, exercises_started_at: 0 }, {}, o);
    expect(stageAt(s, MIN)).toBe("exercises");
    expect(stageAt(s, 35 * MIN)).toBe("post_survey");
  });

  it("sends a student who declined to the exercises, then done, with no checks", () => {
    const s = state({ consented: false, exercises_started_at: 0 });
    expect(stageAt(s, MIN)).toBe("exercises");
    expect(stageAt(s, 35 * MIN)).toBe("done");
  });

  it("is done after the post-survey, and open in practice", () => {
    expect(stageAt(state({ ...answered, post_survey: { a: "1" } }), 0)).toBe("done");
    expect(stageAt(state(answered, { phase: "practice" }), 0)).toBe("open");
  });

  it("gives each order its forms", () => {
    expect([formFor("AB", "pre"), formFor("AB", "post")]).toEqual(["A", "B"]);
    expect([formFor("BA", "pre"), formFor("BA", "post")]).toEqual(["B", "A"]);
  });
});
