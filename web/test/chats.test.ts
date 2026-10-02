import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";

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

async function createMockStudent(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.runMutation(components.betterAuth.adapter.insertOne, {
      model: "user",
      document: {
        name: "Student User",
        email: "student@rmit.edu.vn",
        emailVerified: true,
        role: "student",
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

    const customUserId = await ctx.db.insert("users", {
      name: "Student User",
      email: "student@rmit.edu.vn",
      tokenIdentifier: userId,
      role: "student",
    });

    await ctx.db.insert("userProfiles", {
      userId: customUserId,
      tokenIdentifier: userId,
      invitationCode: "TESTCODE",
    });

    return t.withIdentity({ subject: userId, sessionId });
  });
}

async function setupLessonChat(t: ReturnType<typeof setup>) {
  const admin = await createMockAdmin(t);
  const course = await admin.mutation(api.courses.createCourse, {
    course_name: "Test Course",
    course_language: "python",
  });
  const lessonId = await admin.mutation(api.lessons.createLesson, {
    course,
    week: 5,
    problem_name: "Test Lesson",
    problem_description: "Sum a list",
    knowledge_component: "loops",
  });
  const student = await createMockStudent(t);
  const chatId = await student.mutation(api.chats.getOrCreateChat, { lessonId });
  return { admin, student, lessonId, chatId };
}

// Tutor replies are written by the Python server (addSystemMessage + backend secret).
async function insertTutorReply(t: ReturnType<typeof setup>, chatId: Id<"chats">, content: string) {
  await t.run(async (ctx) => {
    await ctx.db.insert("chatMessages", { chatId, sender: "assistant", content, sentBySystem: true });
  });
}

describe("chats API", () => {
  it("getOrCreateChat creates a new chat if none exists", async () => {
    const t = setup();
    const admin = await createMockAdmin(t);
    const course = await admin.mutation(api.courses.createCourse, {
      course_name: "Test Course",
      course_language: "python",
    });
    const lessonId = await admin.mutation(api.lessons.createLesson, {
      course,
      week: 1,
      problem_name: "Test Lesson",
      problem_description: "x",
      knowledge_component: "loops",
    });

    const student = await createMockStudent(t);
    
    // Initial fetch should return empty messages since chat doesn't exist
    const messagesBefore = await student.query(api.chats.getMessages, { lessonId });
    expect(messagesBefore).toEqual([]);

    // Create the chat
    const chatId = await student.mutation(api.chats.getOrCreateChat, { lessonId });
    expect(chatId).toBeDefined();

    // Fetching again should return the SAME chatId
    const sameChatId = await student.mutation(api.chats.getOrCreateChat, { lessonId });
    expect(sameChatId).toBe(chatId);
  });

  it("addMessage enforces the Get help lock", async () => {
    const t = setup();
    const { student, lessonId, chatId } = await setupLessonChat(t);

    // Before any failed Submit: neither Get help nor typed messages.
    await expect(
      student.mutation(api.chats.addMessage, { chatId, sender: "user", content: "help", trigger: "get_help" })
    ).rejects.toThrow("Get help unlocks after a failed Submit");
    await expect(
      student.mutation(api.chats.addMessage, { chatId, sender: "user", content: "hi" })
    ).rejects.toThrow("Chat unlocks after Get help");

    // A failed Submit unlocks Get help, but typing still waits for the tutor's reply.
    await student.mutation(api.courses.recordCodeExecution, {
      lessonId,
      passed: false,
      actionType: "submit",
      errorTrace: "Input: 3 | Expected: 6 | Got: 5",
    });
    await student.mutation(api.chats.addMessage, {
      chatId,
      sender: "user",
      content: "Please provide me an example to help me with this",
      trigger: "get_help",
    });
    await expect(
      student.mutation(api.chats.addMessage, { chatId, sender: "user", content: "hi" })
    ).rejects.toThrow("Chat unlocks after Get help");

    // Once the tutor has replied, typing works and Get help can't be repeated.
    await insertTutorReply(t, chatId, "an example");
    await student.mutation(api.chats.addMessage, { chatId, sender: "user", content: "why?" });
    await expect(
      student.mutation(api.chats.addMessage, { chatId, sender: "user", content: "again", trigger: "get_help" })
    ).rejects.toThrow("Help has already started");

    const messages = await student.query(api.chats.getMessages, { lessonId });
    expect(messages.map((m) => [m.sender, m.content, m.trigger])).toEqual([
      ["user", "Please provide me an example to help me with this", "get_help"],
      ["assistant", "an example", undefined],
      ["user", "why?", undefined],
    ]);
  });

  it("getChatContext returns the conversation, failure info, and only to its owner", async () => {
    const t = setup();
    const { admin, student, lessonId, chatId } = await setupLessonChat(t);
    await student.mutation(api.courses.recordCodeExecution, {
      lessonId,
      passed: false,
      actionType: "submit",
      errorTrace: "Input: 3 | Expected: 6 | Got: 5",
    });
    // A failed Run does not count.
    await student.mutation(api.courses.recordCodeExecution, { lessonId, passed: false, actionType: "run" });
    await student.mutation(api.chats.addMessage, { chatId, sender: "user", content: "first", trigger: "get_help" });
    await insertTutorReply(t, chatId, "an example");
    await student.mutation(api.chats.addMessage, { chatId, sender: "user", content: "follow-up" });

    const context = await student.query(api.chats.getChatContext, { chatId });
    expect(context.original_problem).toBe("Sum a list");
    expect(context.bkt_prob_mastery).toBeNull();
    expect(context.failed_submits).toBe(1);
    expect(context.error_trace).toBe("Input: 3 | Expected: 6 | Got: 5");
    expect(context.messages).toEqual([
      { sender: "user", content: "first" },
      { sender: "assistant", content: "an example" },
      { sender: "user", content: "follow-up" },
    ]);

    // Another user can't read this student's conversation.
    await expect(admin.query(api.chats.getChatContext, { chatId })).rejects.toThrow("Unauthorized");
  });
});
