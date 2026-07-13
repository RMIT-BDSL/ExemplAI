import { v } from "convex/values";
import { authenticatedMutation, authenticatedQuery } from "./functions";

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

// Add a message to the chat (user path)
export const addMessage = authenticatedMutation({
  args: {
    chatId: v.id("chats"),
    sender: v.literal("user"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");
    if (chat.userId !== ctx.customUser._id) throw new Error("Unauthorized");

    await ctx.db.insert("chatMessages", {
      chatId: args.chatId,
      sender: args.sender,
      content: args.content,
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

// Clear a chat by deleting the chat document and all its messages
export const clearChat = authenticatedMutation({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", ctx.customUser._id).eq("lessonId", args.lessonId)
      )
      .unique();

    if (!chat) return { success: true }; // Nothing to clear

    // Delete all messages
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    
    // Delete the chat itself
    await ctx.db.delete(chat._id);

    return { success: true };
  },
});

// Fetch full problem context and BKT mastery for a given chat, meant to be called by the backend
export const getChatContext = authenticatedQuery({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");
    if (chat.userId !== ctx.customUser._id) throw new Error("Unauthorized");

    const lesson = await ctx.db.get(chat.lessonId);
    if (!lesson) throw new Error("Lesson not found");

    let probMastery = 0.0;
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

    return {
      original_problem: lesson.problem_description || "",
      // unit_test_assertions: unitTestAssertions,
      current_knowledge_component: lesson.knowledge_component || "",
      bkt_prob_mastery: probMastery,
    };
  },
});
