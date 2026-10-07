import { describe, it, expect } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import { inLessonOrder, unlockedLessons } from "../convex/lessonAccess";
import { LESSON_ORDER, lessonPositions } from "../convex/seed";

const lesson = (id: string, week: number, position?: number, at = 0) => ({
  _id: id as Id<"questions">,
  week,
  position,
  _creationTime: at,
});
const done = (id: string) => ({ lessonId: id as Id<"questions">, status: "completed" as const });
const started = (id: string) => ({ lessonId: id as Id<"questions">, status: "in-progress" as const });

// Deliberately out of order: week 2 before week 1, positions shuffled.
const lessons = [lesson("w2b", 2, 2), lesson("w1c", 1, 3), lesson("w1a", 1, 1), lesson("w2a", 2, 1), lesson("w1b", 1, 2)];

describe("lesson order", () => {
  it("sorts by week, then position", () => {
    expect(inLessonOrder(lessons).map((l) => l._id)).toEqual(["w1a", "w1b", "w1c", "w2a", "w2b"]);
  });

  it("puts lessons without a position last in their week, oldest first", () => {
    const mixed = [lesson("new", 1, undefined, 5), lesson("old", 1, undefined, 1), lesson("first", 1, 1, 9)];
    expect(inLessonOrder(mixed).map((l) => l._id)).toEqual(["first", "old", "new"]);
  });
});

describe("unlocks", () => {
  it("opens only each week's first lesson for a new student", () => {
    expect([...unlockedLessons(lessons, [])].sort()).toEqual(["w1a", "w2a"]);
  });

  it("opens the next lesson once the one before it is completed", () => {
    expect(unlockedLessons(lessons, [done("w1a")]).has("w1b" as Id<"questions">)).toBe(true);
    expect(unlockedLessons(lessons, [done("w1a")]).has("w1c" as Id<"questions">)).toBe(false);
  });

  it("doesn't open the next lesson for a lesson that's only started", () => {
    expect(unlockedLessons(lessons, [started("w1a")]).has("w1b" as Id<"questions">)).toBe(false);
  });

  it("keeps a started or completed lesson open even out of order", () => {
    // e.g. a lesson moved later in the week after the student had begun it
    const open = unlockedLessons(lessons, [started("w1c")]);
    expect(open.has("w1c" as Id<"questions">)).toBe(true);
  });

  it("doesn't carry a completion across weeks", () => {
    // finishing week 1's last lesson doesn't skip week 2's order
    const open = unlockedLessons(lessons, [done("w1a"), done("w1b"), done("w1c")]);
    expect(open.has("w2b" as Id<"questions">)).toBe(false);
  });
});

describe("seed order", () => {
  it("gives every seeded lesson exactly one position", () => {
    const positions = lessonPositions();
    expect(positions.size).toBe(Object.values(LESSON_ORDER).flat().length);
    expect(positions.get("convertToDegrees")).toBe(1);
    expect(positions.get("countNotes")).toBe(14);
  });

  it("keeps week-2 twins next to each other", () => {
    const week2 = LESSON_ORDER[2];
    for (const [a, b] of [["howManyEggCartons", "howManyVans"], ["kthDigit", "removeKthDigit"], ["makeChange", "countNotes"]]) {
      expect(week2.indexOf(b) - week2.indexOf(a)).toBe(1);
    }
  });
});

describe("staff", () => {
  it("are never locked: admin or management role, or ctx.isAdmin", async () => {
    const { bypassesLocks } = await import("../convex/lessonAccess");
    expect(bypassesLocks({ role: "admin" }, false)).toBe(true);
    expect(bypassesLocks({ role: "management" }, false)).toBe(true);
    expect(bypassesLocks({ role: undefined }, true)).toBe(true); // role on the login account
    expect(bypassesLocks({ role: undefined }, false)).toBe(false);
    expect(bypassesLocks({ role: "student" }, false)).toBe(false);
  });
});
