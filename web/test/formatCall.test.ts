import { describe, expect, it } from "vitest";
import { formatCall } from "../src/components/student/problem/Problem";

describe("formatCall", () => {
  it("shows arguments as Python literals, nested too", () => {
    expect(formatCall("f", "15, true")).toBe("f(15, True)");
    expect(formatCall("f", "[[true, false], null]")).toBe("f([True, False], None)");
    expect(formatCall("f", '"hi", 2.5')).toBe('f("hi", 2.5)');
    expect(formatCall("f", '{"a": true}')).toBe('f({"a": True})');
  });
});
