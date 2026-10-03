import { describe, it, expect } from "vitest";
import {
  firstTryByBand,
  isFirstTry,
  isSubmitted,
  mean,
  modeForMastery,
  modeFromModel,
} from "../convex/students";

// Pure unit tests for the admin student metrics (no convexTest needed).

describe("student metrics", () => {
  it("counts a lesson as submitted only after a Submit, and first-try only with no failures", () => {
    expect(isSubmitted({ status: "in-progress" })).toBe(false); // opened or Run only
    expect(isSubmitted({ status: "in-progress", failed_submits: 1 })).toBe(true);
    expect(isSubmitted({ status: "completed" })).toBe(true);

    expect(isFirstTry({ status: "completed", failed_submits: 0 })).toBe(true);
    expect(isFirstTry({ status: "completed" })).toBe(true);
    expect(isFirstTry({ status: "completed", failed_submits: 2 })).toBe(false);
    expect(isFirstTry({ status: "in-progress", failed_submits: 0 })).toBe(false);
  });

  it("maps mastery to the same example mode as the server orchestrator", () => {
    expect(modeForMastery(0)).toBe("complete");
    expect(modeForMastery(0.29)).toBe("complete");
    expect(modeForMastery(0.3)).toBe("faded");
    expect(modeForMastery(0.43)).toBe("faded");
    expect(modeForMastery(0.7)).toBe("faded");
    expect(modeForMastery(0.71)).toBe("erroneous");
  });

  it("reads the example mode from the tutor reply's recorded node", () => {
    expect(modeFromModel("faded_example_node")).toBe("faded");
    expect(modeFromModel("control_agent_node")).toBe("control");
    expect(modeFromModel("guardrail_blocked")).toBe("blocked");
    expect(modeFromModel(undefined)).toBeNull();
    expect(modeFromModel("new-model-test")).toBeNull();
  });

  it("computes a mean, null when empty", () => {
    expect(mean([])).toBeNull();
    expect(mean([0.2, 0.4])).toBeCloseTo(0.3);
  });

  it("groups first-try passes by mastery going into the lesson", () => {
    const bands = firstTryByBand([
      { status: "completed", failed_submits: 0, mastery_before: 0.15 }, // complete, first try
      { status: "completed", failed_submits: 2, mastery_before: 0.2 }, // complete, not first try
      { status: "in-progress", failed_submits: 1, mastery_before: 0.5 }, // faded, failing
      { status: "completed", failed_submits: 0, mastery_before: 0.9 }, // erroneous, first try
      { status: "completed", failed_submits: 0 }, // before mastery_before existed: skipped
      { status: "in-progress", mastery_before: 0.5 }, // opened, never submitted: skipped
    ]);
    expect(bands).toEqual([
      { band: "complete", lessons: 2, firstTry: 1 },
      { band: "faded", lessons: 1, firstTry: 0 },
      { band: "erroneous", lessons: 1, firstTry: 1 },
    ]);
  });
});
