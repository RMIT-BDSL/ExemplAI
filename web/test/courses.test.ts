import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";

// convex-test needs every Convex module so it can resolve function references.
// Tests live outside the `convex/` folder, so we hand it the glob explicitly.
const modules = import.meta.glob("../convex/**/*.ts");

const setup = () => convexTest(schema, modules);

async function createMockAdmin(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.runMutation(components.betterAuth.adapter.insertOne, {
      model: "user",
      document: {
        name: "Admin User",
        email: "admin@rmit.edu.vn",
        emailVerified: true,
        role: "admin",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    const sessionId = await ctx.runMutation(components.betterAuth.adapter.insertOne, {
      model: "session",
      document: {
        userId,
        expiresAt: Date.now() + 1000 * 60 * 60,
        token: `token-${userId}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    await ctx.db.insert("users", {
      name: "Admin User",
      email: "admin@rmit.edu.vn",
      tokenIdentifier: userId,
      role: "admin",
    });

    return t.withIdentity({ subject: userId, sessionId });
  });
}

const sampleTestCases = [
  { input: "2 3", expectedOutput: "5" },
  { input: "10 5", expectedOutput: "15", description: "larger numbers" },
  { input: "0 0", expectedOutput: "0", hidden: true },
];

describe("course CRUD", () => {
  it("creates a course and reads it back", async () => {
    const t = setup();
    const client = await createMockAdmin(t);

    const id = await client.mutation(api.courses.createCourse, {
      course_name: "Intro to Python",
      course_language: "python",
    });

    const course = await client.query(api.courses.getCourse, { id });
    expect(course).toMatchObject({
      course_name: "Intro to Python",
      course_language: "python",
    });
  });

  it("lists courses newest first", async () => {
    const t = setup();
    const client = await createMockAdmin(t);

    await client.mutation(api.courses.createCourse, {
      course_name: "First",
      course_language: "python",
    });
    await client.mutation(api.courses.createCourse, {
      course_name: "Second",
      course_language: "javascript",
    });

    const courses = await client.query(api.courses.listCourses, {});
    expect(courses).toHaveLength(2);
    expect(courses[0].course_name).toBe("Second");
  });

  it("updates only the provided fields", async () => {
    const t = setup();
    const client = await createMockAdmin(t);

    const id = await client.mutation(api.courses.createCourse, {
      course_name: "Old name",
      course_language: "python",
    });

    await client.mutation(api.courses.updateCourse, { id, course_name: "New name" });

    const course = await client.query(api.courses.getCourse, { id });
    expect(course).toMatchObject({
      course_name: "New name",
      course_language: "python", // untouched
    });
  });

  it("rejects an empty course name (Zod validation)", async () => {
    const t = setup();
    const client = await createMockAdmin(t);

    await expect(
      client.mutation(api.courses.createCourse, {
        course_name: "",
        course_language: "python",
      })
    ).rejects.toThrow();
  });

  it("deleting a course cascades to its lessons and their progress", async () => {
    const t = setup();
    const client = await createMockAdmin(t);

    const courseId = await client.mutation(api.courses.createCourse, {
      course_name: "Course to delete",
      course_language: "python",
    });
    const lessonId = await client.mutation(api.lessons.createLesson, {
      course: courseId,
      week: 1,
      problem_name: "Sum two numbers",
      problem_description: "Add two integers",
      testCases: sampleTestCases,
    });

    // Give a student some progress on the lesson, then delete the course.
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { tokenIdentifier: "tok-1" })
    );
    await t.run(async (ctx) =>
      ctx.db.insert("lessonProgress", {
        userId,
        lessonId,
        status: "in-progress",
      })
    );

    await client.mutation(api.courses.deleteCourse, { id: courseId });

    expect(await client.query(api.courses.getCourse, { id: courseId })).toBeNull();
    expect(await client.query(api.lessons.getLesson, { id: lessonId })).toBeNull();
    const remainingProgress = await t.run(async (ctx) =>
      ctx.db.query("lessonProgress").collect()
    );
    expect(remainingProgress).toHaveLength(0);
  });
});

describe("lesson CRUD", () => {
  const makeCourse = async (client: ReturnType<typeof setup>["withIdentity"]) =>
    client.mutation(api.courses.createCourse, {
      course_name: "Host course",
      course_language: "python",
    });

  it("creates a lesson with test cases", async () => {
    const t = setup();
    const client = await createMockAdmin(t);
    const course = await makeCourse(client);

    const id = await client.mutation(api.lessons.createLesson, {
      course,
      week: 3,
      problem_name: "Sum",
      problem_description: "Add two integers",
      detail: "Read two ints from stdin and print their sum.",
      testCases: sampleTestCases,
    });

    const lesson = await client.query(api.lessons.getLesson, { id });
    expect(lesson).toMatchObject({
      week: 3,
      problem_name: "Sum",
      detail: "Read two ints from stdin and print their sum.",
    });
    expect(lesson?.testCases).toHaveLength(3);
    expect(lesson?.testCases?.[2]).toMatchObject({ hidden: true });
  });

  it("defaults testCases to an empty array when omitted", async () => {
    const t = setup();
    const client = await createMockAdmin(t);
    const course = await makeCourse(client);

    const id = await client.mutation(api.lessons.createLesson, {
      course,
      week: 1,
      problem_name: "No tests yet",
      problem_description: "todo",
    });

    const lesson = await client.query(api.lessons.getLesson, { id });
    expect(lesson?.testCases).toEqual([]);
  });

  it("lists lessons of a course ordered by week", async () => {
    const t = setup();
    const client = await createMockAdmin(t);
    const course = await makeCourse(client);

    for (const week of [3, 1, 2]) {
      await client.mutation(api.lessons.createLesson, {
        course,
        week,
        problem_name: `Week ${week}`,
        problem_description: "x",
      });
    }

    const lessons = await client.query(api.lessons.listLessonsByCourse, { course });
    expect(lessons.map((l) => l.week)).toEqual([1, 2, 3]);
  });

  it("does not return lessons from other courses", async () => {
    const t = setup();
    const client = await createMockAdmin(t);
    const courseA = await makeCourse(client);
    const courseB = await client.mutation(api.courses.createCourse, {
      course_name: "Other",
      course_language: "javascript",
    });

    await client.mutation(api.lessons.createLesson, {
      course: courseA,
      week: 1,
      problem_name: "A1",
      problem_description: "x",
    });
    await client.mutation(api.lessons.createLesson, {
      course: courseB,
      week: 1,
      problem_name: "B1",
      problem_description: "x",
    });

    const lessons = await client.query(api.lessons.listLessonsByCourse, {
      course: courseA,
    });
    expect(lessons).toHaveLength(1);
    expect(lessons[0].problem_name).toBe("A1");
  });

  it("updates a lesson's fields", async () => {
    const t = setup();
    const client = await createMockAdmin(t);
    const course = await makeCourse(client);

    const id = await client.mutation(api.lessons.createLesson, {
      course,
      week: 1,
      problem_name: "Original",
      problem_description: "x",
    });

    await client.mutation(api.lessons.updateLesson, {
      id,
      week: 5,
      problem_name: "Renamed",
      testCases: [{ input: "1", expectedOutput: "1" }],
    });

    const lesson = await client.query(api.lessons.getLesson, { id });
    expect(lesson).toMatchObject({ week: 5, problem_name: "Renamed" });
    expect(lesson?.testCases).toHaveLength(1);
  });

  it("rejects a week outside the 1-12 range (Zod validation)", async () => {
    const t = setup();
    const client = await createMockAdmin(t);
    const course = await makeCourse(client);

    await expect(
      client.mutation(api.lessons.createLesson, {
        course,
        week: 13,
        problem_name: "Too late",
        problem_description: "x",
      })
    ).rejects.toThrow();
  });

  it("rejects creating a lesson for a missing course", async () => {
    const t = setup();
    const client = await createMockAdmin(t);
    const course = await makeCourse(client);
    // Create then delete so we hold a real-but-dangling id.
    await client.mutation(api.courses.deleteCourse, { id: course });

    await expect(
      client.mutation(api.lessons.createLesson, {
        course,
        week: 1,
        problem_name: "Orphan",
        problem_description: "x",
      })
    ).rejects.toThrow("Course not found");
  });

  it("deletes a lesson and its progress rows", async () => {
    const t = setup();
    const client = await createMockAdmin(t);
    const course = await makeCourse(client);
    const lessonId = await client.mutation(api.lessons.createLesson, {
      course,
      week: 1,
      problem_name: "Bye",
      problem_description: "x",
    });

    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { tokenIdentifier: "tok-2" })
    );
    await t.run(async (ctx) =>
      ctx.db.insert("lessonProgress", {
        userId,
        lessonId,
        status: "completed",
      })
    );

    await client.mutation(api.lessons.deleteLesson, { id: lessonId });

    expect(await client.query(api.lessons.getLesson, { id: lessonId })).toBeNull();
    const progress = await t.run(async (ctx) =>
      ctx.db.query("lessonProgress").collect()
    );
    expect(progress).toHaveLength(0);
  });
});
