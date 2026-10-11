import { describe, expect, it } from "vitest";
import {
  balancedGroups,
  idEmail,
  idPassword,
  isIdEmail,
  isValidStudentId,
  normalizeStudentId,
  shuffled,
  studentIdFromEmail,
} from "../convex/studentIds";

describe("student IDs", () => {
  it("normalizes what students type", () => {
    expect(normalizeStudentId(" s3912345 ")).toBe("S3912345");
    expect(normalizeStudentId("s 391 2345")).toBe("S3912345");
  });

  it("accepts university-style IDs and rejects junk", () => {
    expect(isValidStudentId("S3912345")).toBe(true);
    expect(isValidStudentId("AB")).toBe(false);
    expect(isValidStudentId("S39@12")).toBe(false);
  });

  it("maps an ID to one account email and back", () => {
    const email = idEmail("s3912345");
    expect(email).toBe("s3912345@id.exemplai.local");
    expect(isIdEmail(email)).toBe(true);
    expect(studentIdFromEmail(email)).toBe("S3912345");
    expect(studentIdFromEmail("someone@rmit.edu.vn")).toBeNull();
    expect(idPassword("s3912345")).toBe(idPassword("S3912345"));
    expect(idPassword("s3912345").length).toBeGreaterThanOrEqual(8);
  });
});

describe("balanced groups", () => {
  it("keeps a new roster within one of 50/50", () => {
    for (const n of [1, 2, 7, 30, 31]) {
      const g = balancedGroups({ experimental: 0, control: 0 }, n);
      const e = g.filter((x) => x === "experimental").length;
      expect(Math.abs(e - (n - e))).toBeLessThanOrEqual(1);
    }
  });

  it("evens out a cohort that is already lopsided", () => {
    const g = balancedGroups({ experimental: 5, control: 1 }, 4);
    expect(g).toEqual(["control", "control", "control", "control"]);
  });

  it("breaks ties at random", () => {
    expect(balancedGroups({ experimental: 0, control: 0 }, 1, () => 0.1)).toEqual(["experimental"]);
    expect(balancedGroups({ experimental: 0, control: 0 }, 1, () => 0.9)).toEqual(["control"]);
  });

  it("shuffles without losing anyone", () => {
    const ids = ["A1", "B2", "C3", "D4"];
    expect(shuffled(ids).sort()).toEqual(ids);
  });
});
