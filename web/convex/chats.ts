import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";

// The tutor's first reply in a lesson comes from "Get help", which unlocks
// after a failed Submit; typed messages unlock once that first reply exists.
async function lessonProgressFor(ctx: QueryCtx, userId: Id<"users">, lessonId: Id<"questions">) {
  return await ctx.db
    .query("lessonProgress")
    .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonId", lessonId))
    .unique();
}

async function hasTutorReply(ctx: QueryCtx, chatId: Id<"chats">) {
  const messages = await ctx.db
    .query("chatMessages")
    .withIndex("by_chat", (q) => q.eq("chatId", chatId))
    .collect();
  return messages.some((m) => m.sender === "assistant");
}

// Get messages for a given lesson chat
export const getMessages = authenticatedQuery({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", ctx.customUser._id).eq("lessonId", args.lessonId)
      )
      .unique();
    if (!chat) return [];

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
      .collect();
      
    // Sort chronologically (Convex _creationTime is implicit, but collecting usually preserves insertion order. Better to sort explicitly just in case)
    return messages.sort((a, b) => a._creationTime - b._creationTime);
  },
});

// Gets the chat ID, creating it if it doesn't exist. Useful for the UI to know the chatId to pass to Python.
export const getOrCreateChat = authenticatedMutation({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    let chat = await ctx.db
      .query("chats")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", ctx.customUser._id).eq("lessonId", args.lessonId)
      )
      .unique();
      
    if (!chat) {
      const chatId = await ctx.db.insert("chats", {
        userId: ctx.customUser._id,
        lessonId: args.lessonId,
      });
      return chatId;
    }
    return chat._id;
  },
});

// Add a message to the chat (user path). `trigger: "get_help"` marks the turn
// created by the Get help button.
export const addMessage = authenticatedMutation({
  args: {
    chatId: v.id("chats"),
    sender: v.literal("user"),
    content: v.string(),
    trigger: v.optional(v.literal("get_help")),
  },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");
    if (chat.userId !== ctx.customUser._id) throw new Error("Unauthorized");

    const helpStarted = await hasTutorReply(ctx, args.chatId);
    if (args.trigger === "get_help") {
      const progress = await lessonProgressFor(ctx, chat.userId, chat.lessonId);
      if ((progress?.failed_submits ?? 0) < 1) {
        throw new Error("Get help unlocks after a failed Submit");
      }
      if (helpStarted) throw new Error("Help has already started for this lesson");
    } else if (!helpStarted) {
      throw new Error("Chat unlocks after Get help");
    }

    await ctx.db.insert("chatMessages", {
      chatId: args.chatId,
      sender: args.sender,
      content: args.content,
      ...(args.trigger ? { trigger: args.trigger } : {}),
    });
    return { success: true };
  },
});

// Add a trusted system/assistant message (backend path)
export const addSystemMessage = authenticatedMutation({
  args: {
    chatId: v.id("chats"),
    sender: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    sentBySystem: v.optional(v.boolean()),
    model: v.optional(v.string()),
    backendSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.backendSecret !== process.env.CONVEX_BACKEND_SECRET) {
      throw new Error("Unauthorized: Invalid backend secret");
    }
    if (!ctx.customUser) throw new Error("User not found");
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");
    if (chat.userId !== ctx.customUser._id) throw new Error("Unauthorized");

    await ctx.db.insert("chatMessages", {
      chatId: args.chatId,
      sender: args.sender,
      content: args.content,
      sentBySystem: args.sentBySystem,
      model: args.model,
    });
    return { success: true };
  },
});

// Most recent turns the tutor sees; older ones stay stored but aren't sent to the LLM.
const CHAT_HISTORY_LIMIT = 20;

// Fetch full problem context, BKT mastery and recent conversation for a given
// chat, meant to be called by the backend. The conversation comes from here
// (not the browser) so it can't be duplicated or forged.
export const getChatContext = authenticatedQuery({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");
    if (chat.userId !== ctx.customUser._id) throw new Error("Unauthorized");

    const lesson = await ctx.db.get(chat.lessonId);
    if (!lesson) throw new Error("Lesson not found");

    // null = no graded Submit on this KC yet; the Python server substitutes
    // the BKT cold-start prior (P-Init) so routing starts from 0.15, not 0.
    let probMastery: number | null = null;
    if (lesson.knowledge_component) {
      const bkt = await ctx.db
        .query("bktMastery")
        .withIndex("by_user_kc", (q) =>
          q.eq("userId", chat.userId).eq("knowledge_component", lesson.knowledge_component as string)
        )
        .unique();
      if (bkt) {
        probMastery = bkt.prob_mastery;
      }
    }

    // let unitTestAssertions = "";
    // if (lesson.testCases && lesson.testCases.length > 0) {
    //   unitTestAssertions = lesson.testCases
    //     .map((tc) => `Input: ${tc.input} | Expected Output: ${tc.expectedOutput}`)
    //     .join("\n");
    // }

    const progress = await lessonProgressFor(ctx, chat.userId, chat.lessonId);

    const recent = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .take(CHAT_HISTORY_LIMIT);

    return {
      original_problem: lesson.problem_description || "",
      // unit_test_assertions: unitTestAssertions,
      current_knowledge_component: lesson.knowledge_component || "",
      bkt_prob_mastery: probMastery,
      // Oldest first, ending with the student's latest message.
      messages: recent.reverse().map((m) => ({ sender: m.sender, content: m.content })),
      failed_submits: progress?.failed_submits ?? 0,
      error_trace: progress?.last_error_trace ?? "",
    };
  },
});
