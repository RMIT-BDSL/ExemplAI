import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const setup = () => convexTest(schema, modules);

async function createMockUser(
  t: ReturnType<typeof setup>,
  email: string,
  role: string = "student"
) {
  return await t.run(async (ctx) => {
    // 1. Insert into Better Auth 'user' table via component
    const userId = await ctx.runMutation(components.betterAuth.adapter.insertOne, {
      model: "user",
      document: {
        name: "Test User",
        email,
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        role,
      },
    });

    // 2. Insert into Better Auth 'session' table via component
    const sessionId = await ctx.runMutation(components.betterAuth.adapter.insertOne, {
      model: "session",
      document: {
        userId,
        expiresAt: Date.now() + 1000 * 60 * 60, // 1 hour expiry
        token: `token-${userId}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    // 3. Sync to custom 'users' table
    const customUserId = await ctx.db.insert("users", {
      name: "Test User",
      email,
      tokenIdentifier: userId,
      role,
    });

    return { userId, sessionId, customUserId };
  });
}

describe("Security Enforcement", () => {
  it("blocks unauthenticated callers from course listing", async () => {
    const t = setup();
    await expect(t.query(api.courses.listCourses, {})).rejects.toThrow("Unauthenticated");
  });

  it("blocks unauthenticated callers from administrative course creation", async () => {
    const t = setup();
    await expect(
      t.mutation(api.courses.createCourse, {
        course_name: "Intro to Security",
        course_language: "python",
      })
    ).rejects.toThrow("Unauthenticated");
  });

  it("blocks authenticated students who lack an invitation profile", async () => {
    const t = setup();
    const { userId, sessionId } = await createMockUser(t, "student@rmit.edu.vn", "student");

    const client = t.withIdentity({
      subject: userId,
      sessionId,
    });

    await expect(client.query(api.courses.listCourses, {})).rejects.toThrow(
      "Student profile required"
    );
  });

  it("allows authenticated students with an invitation profile to view courses", async () => {
    const t = setup();
    const { userId, sessionId, customUserId } = await createMockUser(t, "student@rmit.edu.vn", "student");

    // Add profile
    await t.run(async (ctx) => {
      await ctx.db.insert("userProfiles", {
        userId: customUserId,
        tokenIdentifier: userId,
        invitationCode: "VALIDCODE",
      });
    });

    const client = t.withIdentity({
      subject: userId,
      sessionId,
    });

    const courses = await client.query(api.courses.listCourses, {});
    expect(courses).toEqual([]);
  });

  it("blocks students from creating courses", async () => {
    const t = setup();
    const { userId, sessionId, customUserId } = await createMockUser(t, "student@rmit.edu.vn", "student");

    // Add profile
    await t.run(async (ctx) => {
      await ctx.db.insert("userProfiles", {
        userId: customUserId,
        tokenIdentifier: userId,
        invitationCode: "VALIDCODE",
      });
    });

    const client = t.withIdentity({
      subject: userId,
      sessionId,
    });

    await expect(
      client.mutation(api.courses.createCourse, {
        course_name: "Hacking 101",
        course_language: "python",
      })
    ).rejects.toThrow("Admin privilege required");
  });

  it("allows admins to create courses even without an invitation profile", async () => {
    const t = setup();
    const { userId, sessionId } = await createMockUser(t, "admin@rmit.edu.vn", "admin");

    const client = t.withIdentity({
      subject: userId,
      sessionId,
    });

    const courseId = await client.mutation(api.courses.createCourse, {
      course_name: "Advanced Security",
      course_language: "javascript",
    });

    const course = await client.query(api.courses.getCourse, { id: courseId });
    expect(course?.course_name).toBe("Advanced Security");
  });

  it("blocks students from listing invitation codes", async () => {
    const t = setup();
    const { userId, sessionId, customUserId } = await createMockUser(t, "student@rmit.edu.vn", "student");

    await t.run(async (ctx) => {
      await ctx.db.insert("userProfiles", {
        userId: customUserId,
        tokenIdentifier: userId,
        invitationCode: "VALIDCODE",
      });
    });

    const client = t.withIdentity({
      subject: userId,
      sessionId,
    });

    await expect(client.query(api.invitationCodes.listAll, {})).rejects.toThrow(
      "Admin privilege required"
    );
  });

  it("allows admins to manage invitation codes", async () => {
    const t = setup();
    const { userId, sessionId } = await createMockUser(t, "admin@rmit.edu.vn", "admin");

    const client = t.withIdentity({
      subject: userId,
      sessionId,
    });

    const codeId = await client.mutation(api.invitationCodes.add, {
      code: "NEW-CODE",
      quantity: 5,
    });

    const codes = await client.query(api.invitationCodes.listAll, {});
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe("NEW-CODE");
  });
});
