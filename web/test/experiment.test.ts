import { describe, it, expect, afterEach } from "vitest";
import { BLOCK_SIZE, conditionToggleEnabled, shuffledBlock } from "../convex/experiment";

describe("blocked randomization", () => {
  it("hands out half of each group in every block", () => {
    for (let i = 0; i < 50; i++) {
      const block = shuffledBlock();
      expect(block).toHaveLength(BLOCK_SIZE);
      expect(block.filter((c) => c === "experimental")).toHaveLength(BLOCK_SIZE / 2);
      expect(block.filter((c) => c === "control")).toHaveLength(BLOCK_SIZE / 2);
    }
  });

  it("shuffles the order", () => {
    const orders = new Set(Array.from({ length: 200 }, () => shuffledBlock().join(",")));
    // 4!/(2!2!) = 6 possible orders; 200 shuffles should hit all of them.
    expect(orders.size).toBe(6);
  });
});

describe("testing toggle", () => {
  afterEach(() => {
    delete process.env.CONDITION_TOGGLE;
  });

  it("is off unless CONDITION_TOGGLE is 'on'", () => {
    expect(conditionToggleEnabled()).toBe(false);
    process.env.CONDITION_TOGGLE = "true";
    expect(conditionToggleEnabled()).toBe(false);
    process.env.CONDITION_TOGGLE = "on";
    expect(conditionToggleEnabled()).toBe(true);
  });
});
