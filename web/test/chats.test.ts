import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";

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

  it("addMessage correctly inserts a message and getMessages retrieves it", async () => {
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
    const chatId = await student.mutation(api.chats.getOrCreateChat, { lessonId });

    // Add a message
    await student.mutation(api.chats.addMessage, {
      chatId,
      sender: "user",
      content: "Hello AI",
    });

    await student.mutation(api.chats.addMessage, {
      chatId,
      sender: "assistant",
      content: "Hello Student",
    });

    const messages = await student.query(api.chats.getMessages, { lessonId });
    expect(messages).toHaveLength(2);
    expect(messages[0].sender).toBe("user");
    expect(messages[0].content).toBe("Hello AI");
    expect(messages[1].sender).toBe("assistant");
    expect(messages[1].content).toBe("Hello Student");
  });

  it("getChatContext returns the conversation oldest-first and only to its owner", async () => {
    const t = setup();
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
    await student.mutation(api.chats.addMessage, { chatId, sender: "user", content: "first" });
    await t.run(async (ctx) => {
      await ctx.db.insert("chatMessages", { chatId, sender: "assistant", content: "an example", sentBySystem: true });
    });
    await student.mutation(api.chats.addMessage, { chatId, sender: "user", content: "follow-up" });

    const context = await student.query(api.chats.getChatContext, { chatId });
    expect(context.original_problem).toBe("Sum a list");
    expect(context.bkt_prob_mastery).toBeNull();
    expect(context.messages).toEqual([
      { sender: "user", content: "first" },
      { sender: "assistant", content: "an example" },
      { sender: "user", content: "follow-up" },
    ]);

    // Another user can't read this student's conversation.
    await expect(admin.query(api.chats.getChatContext, { chatId })).rejects.toThrow("Unauthorized");
  });
});
