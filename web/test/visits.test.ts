import { describe, it, expect } from "vitest";
import { HEARTBEAT_MS, creditFor } from "../convex/visits";

describe("time on task credit", () => {
  it("credits the reported active time", () => {
    expect(creditFor(20_000, HEARTBEAT_MS)).toBe(20_000);
  });

  it("never credits more than the real time since the last heartbeat", () => {
    // A forged or buggy report of 10 minutes 30 s after the last heartbeat.
    expect(creditFor(600_000, 30_000)).toBe(35_000);
    // Heartbeats sent in quick succession can't stack up time.
    expect(creditFor(30_000, 1_000)).toBe(6_000);
  });

  it("caps a single heartbeat even after a long gap", () => {
    expect(creditFor(600_000, 3_600_000)).toBe(HEARTBEAT_MS + 5_000);
  });

  it("ignores negative reports", () => {
    expect(creditFor(-5_000, 30_000)).toBe(0);
  });
});
