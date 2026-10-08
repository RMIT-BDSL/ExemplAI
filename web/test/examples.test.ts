import { describe, it, expect } from "vitest";
import type { Doc } from "../convex/_generated/dataModel";
import { EXAMPLE_CAP, buttonBlockedReason, computeAllowance } from "../convex/examples";

// Pure unit tests for the example allowance (no convexTest needed).

let t = 1000;
function tutor(response_type?: "new_example" | "follow_up" | "fallback", at = ++t) {
  return { sender: "assistant", content: "x", response_type, _creationTime: at } as unknown as Doc<"chatMessages">;
}
function student(at = ++t) {
  return { sender: "user", content: "x", _creationTime: at } as unknown as Doc<"chatMessages">;
}
function progress(fields: Partial<Doc<"lessonProgress">>) {
  return fields as Doc<"lessonProgress">;
}

describe("example allowance", () => {
  it("is locked until a failed Submit, then Get help gives the first example", () => {
    const none = computeAllowance([], null);
    expect(none).toMatchObject({ cap: 3, used: 0, earned: 0, remaining: 0, helpStarted: false });
    expect(buttonBlockedReason("get_help", none)).toMatch(/failed Submit/);

    const afterFail = computeAllowance([], progress({ failed_submits: 1 }));
    expect(afterFail.remaining).toBe(1);
    expect(buttonBlockedReason("get_help", afterFail)).toBeNull();
    expect(buttonBlockedReason("new_example", afterFail)).toMatch(/Get help first/);
  });

  it("earns each further example with a failed Submit, up to the cap", () => {
    const msgs = [student(), tutor("new_example"), student(), tutor("follow_up")];
    const one = computeAllowance(msgs, progress({ failed_submits: 1 }));
    expect(one).toMatchObject({ used: 1, earned: 1, remaining: 0, exhausted: false, helpStarted: true });
    expect(buttonBlockedReason("new_example", one)).toMatch(/Submit another attempt/);
    expect(buttonBlockedReason("get_help", one)).toMatch(/already been used/);

    const two = computeAllowance(msgs, progress({ failed_submits: 2 }));
    expect(two.remaining).toBe(1);
    expect(buttonBlockedReason("new_example", two)).toBeNull();

    // Ten failed Submits still only earn the cap.
    expect(computeAllowance(msgs, progress({ failed_submits: 10 })).earned).toBe(EXAMPLE_CAP);
  });

  it("counts only delivered new examples, not follow-ups or fallbacks", () => {
    const msgs = [tutor("new_example"), tutor("follow_up"), tutor("fallback"), tutor(undefined)];
    expect(computeAllowance(msgs, progress({ failed_submits: 3 })).used).toBe(1);
  });

  it("is exhausted at the cap and starts a new round after a reset", () => {
    const msgs = [tutor("new_example"), tutor("new_example"), tutor("new_example")];
    const full = computeAllowance(msgs, progress({ failed_submits: 3 }));
    expect(full).toMatchObject({ used: 3, remaining: 0, exhausted: true });
    expect(buttonBlockedReason("new_example", full)).toMatch(/another topic/);

    // openLesson reset: round starts now, no failed Submits yet this round.
    const reset = computeAllowance(msgs, progress({ failed_submits: 3, round_started_at: t + 1, round_failed_submits: 0 }));
    expect(reset).toMatchObject({ used: 0, earned: 0, exhausted: false, helpStarted: true });
    expect(buttonBlockedReason("get_help", reset)).toMatch(/failed Submit/);

    // A failed Submit in the new round re-enables Get help.
    const again = computeAllowance(msgs, progress({ failed_submits: 4, round_started_at: t + 1, round_failed_submits: 1 }));
    expect(buttonBlockedReason("get_help", again)).toBeNull();
  });
});

import { routingMastery } from "../convex/chats";

describe("example type follows the mastery the lesson started with", () => {
  it("uses mastery before the lesson's first Submit once there is one", () => {
    // passed two lessons (0.70), then failed this one's first Submit (live 0.43)
    expect(routingMastery(0.43, { mastery_before: 0.7014 })).toBe(0.7014);
  });

  it("uses live mastery before any Submit on the lesson, and null when there is none", () => {
    expect(routingMastery(0.43, null)).toBe(0.43);
    expect(routingMastery(0.43, {})).toBe(0.43);
    expect(routingMastery(null, null)).toBeNull();
  });
});
