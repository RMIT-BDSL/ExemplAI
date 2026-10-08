import { describe, expect, it } from "vitest";
import { EXAMPLE_WAIT_LINES, exampleWaitLine } from "../src/lib/waitMessages";

describe("example wait lines", () => {
  it("starts on reading the submission", () => {
    expect(EXAMPLE_WAIT_LINES[exampleWaitLine(0, [])]).toBe("Reading your submission");
  });

  it("moves on about every 3 seconds and stops on the last line", () => {
    expect(exampleWaitLine(2, [])).toBe(0);
    expect(exampleWaitLine(3, [])).toBe(1);
    expect(exampleWaitLine(6, [])).toBe(2);
    expect(exampleWaitLine(12, [])).toBe(4);
    expect(EXAMPLE_WAIT_LINES[exampleWaitLine(20, [])]).toBe("Pretty printing");
  });

  it("moves on sooner when the server reports a step", () => {
    expect(exampleWaitLine(1, ["input_guardrail"])).toBe(1);
    expect(exampleWaitLine(1, ["input_guardrail", "faded_example_node"])).toBe(3);
  });

  it("does not jump ahead when the Dean sent a draft back", () => {
    const retry = ["input_guardrail", "faded_example_node", "dean_validation_node"];
    expect(exampleWaitLine(4, retry)).toBe(1);
    expect(exampleWaitLine(4, [...retry, "faded_example_node"])).toBe(3);
  });
});
