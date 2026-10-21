import { describe, expect, it } from "vitest";
import { diffStats, lineDiff } from "../src/components/solve/lineDiff";

describe("lineDiff", () => {
  it("marks every line the same for identical code", () => {
    expect(lineDiff("a\nb", "a\nb")).toEqual([
      { kind: "same", text: "a" },
      { kind: "same", text: "b" },
    ]);
  });

  it("finds a changed line in the middle", () => {
    const diff = lineDiff("def f(x):\n    return x\n", "def f(x):\n    return x * 2\n");
    expect(diff).toEqual([
      { kind: "same", text: "def f(x):" },
      { kind: "del", text: "    return x" },
      { kind: "add", text: "    return x * 2" },
      { kind: "same", text: "" },
    ]);
    expect(diffStats(diff)).toEqual({ added: 1, removed: 1 });
  });

  it("handles lines added at the end and removed at the start", () => {
    expect(diffStats(lineDiff("x\ny", "y\nz\nw"))).toEqual({ added: 2, removed: 1 });
  });
});
