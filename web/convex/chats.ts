import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { allowanceForChat, buttonBlockedReason, lessonProgressFor } from "./examples";
import { ensureCondition } from "./experiment";
import { canOpenLesson } from "./lessonAccess";
import { rejectedDraft } from "./schema";
import { authenticatedMutation, authenticatedQuery } from "./functions";

// A fresh chat starts each time a lesson is opened (students only see their
// current chat; earlier ones stay in the database for research). So a lesson
// can have several chats; "latest" is the current one.

// What a student may see of a message: rejected drafts can hold the very answer
// the Dean blocked, so they never leave the server.
export function forStudent({ rejected_drafts: _rejected, ...message }: Doc<"chatMessages">) {
  return message;
}

// Messages of the student's latest chat on a lesson (oldest first).
export const getMessages = authenticatedQuery({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", ctx.customUser._id).eq("lessonId", args.lessonId)
      )
      .order("desc")
      .first();
    if (!chat) return [];
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
      .collect();
    return messages.map(forStudent);
  },
});

// Messages of one chat (oldest first); only its owner can read them.
export const getChatMessages = authenticatedQuery({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== ctx.customUser._id) return [];
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    return messages.map(forStudent);
  },
});

// Opens a fresh chat for a lesson: called each time the lesson is opened, and
// again when the testing toggle changes the student's group. Reuses the latest
// chat if nothing was said in it yet, so reloads and double-mounts don't pile
// up empty chats. The first lesson a student opens assigns their group.
export const startChat = authenticatedMutation({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const userId = ctx.customUser._id;
    if (!(await canOpenLesson(ctx, ctx.customUser, args.lessonId, ctx.isAdmin))) {
      throw new Error("This lesson is locked until the one before it is completed");
    }
    const condition = await ensureCondition(ctx, ctx.customUser);
    const latest = await ctx.db
      .query("chats")
      .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonId", args.lessonId))
      .order("desc")
      .first();
    if (latest) {
      const anyMessage = await ctx.db
        .query("chatMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", latest._id))
        .first();
      if (!anyMessage) {
        if (latest.experiment_condition !== condition) {
          await ctx.db.patch(latest._id, { experiment_condition: condition });
        }
        return latest._id;
      }
    }
    return await ctx.db.insert("chats", {
      userId,
      lessonId: args.lessonId,
      experiment_condition: condition,
    });
  },
});

// The student's latest chat on a lesson, created if there is none.
export const getOrCreateChat = authenticatedMutation({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", ctx.customUser._id).eq("lessonId", args.lessonId)
      )
      .order("desc")
      .first();
    if (chat) return chat._id;
    return await ctx.db.insert("chats", {
      userId: ctx.customUser._id,
      lessonId: args.lessonId,
      experiment_condition: await ensureCondition(ctx, ctx.customUser),
    });
  },
});

// Add a message to the chat (user path). `trigger` marks turns created by the
// Get help / New example buttons, which spend the example allowance
// (convex/examples.ts); typed messages need the tutor to have replied once.
// Control chats are a plain chat: no buttons, no lock.
export const addMessage = authenticatedMutation({
  args: {
    chatId: v.id("chats"),
    sender: v.literal("user"),
    content: v.string(),
    trigger: v.optional(v.union(v.literal("get_help"), v.literal("new_example"))),
  },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");
    if (chat.userId !== ctx.customUser._id) throw new Error("Unauthorized");

    if (chat.experiment_condition === "control") {
      if (args.trigger) throw new Error("The control group has no example buttons");
    } else {
      const allowance = await allowanceForChat(ctx, chat);
      if (args.trigger) {
        const blocked = buttonBlockedReason(args.trigger, allowance);
        if (blocked) throw new Error(blocked);
      } else if (!allowance.helpStarted) {
        throw new Error("Chat unlocks after Get help");
      }
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

/**
 * Research links stored on a tutor reply: the Submit it followed (the
 * student's latest Submit on the lesson right now) and their mastery when the
 * server wrote it. Shared with the dev trial simulation.
 */
export async function replyContextFields(
  ctx: MutationCtx,
  chat: Doc<"chats">,
  masteryAtReply: number | undefined,
) {
  const submit = await ctx.db
    .query("codeAttempts")
    .withIndex("by_user_lesson", (q) => q.eq("userId", chat.userId).eq("lessonId", chat.lessonId))
    .order("desc")
    .filter((q) => q.eq(q.field("kind"), "submit"))
    .first();
  return {
    ...(masteryAtReply !== undefined ? { mastery_at_reply: masteryAtReply } : {}),
    ...(submit ? { responds_to_submit: submit._id } : {}),
  };
}

// Add a trusted system/assistant message (backend path)
export const addSystemMessage = authenticatedMutation({
  args: {
    chatId: v.id("chats"),
    sender: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    sentBySystem: v.optional(v.boolean()),
    model: v.optional(v.string()),
    // What a tutor reply delivered; "new_example" counts against the allowance.
    responseType: v.optional(
      v.union(v.literal("new_example"), v.literal("follow_up"), v.literal("fallback"))
    ),
    deanDecision: v.optional(v.string()),
    deanReason: v.optional(v.string()),
    rejectedDrafts: v.optional(v.array(rejectedDraft)),
    // The student's mastery the server routed on (research log).
    masteryAtReply: v.optional(v.number()),
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
      ...(args.responseType ? { response_type: args.responseType } : {}),
      ...(args.deanDecision ? { dean_decision: args.deanDecision } : {}),
      ...(args.deanReason ? { dean_reason: args.deanReason } : {}),
      ...(args.rejectedDrafts?.length ? { rejected_drafts: args.rejectedDrafts } : {}),
      ...(args.sender === "assistant" ? await replyContextFields(ctx, chat, args.masteryAtReply) : {}),
    });
    return { success: true };
  },
});

/**
 * The mastery that picks a lesson's example type (Complete / Faded / Erroneous):
 * the student's mastery of the topic when they started the lesson, i.e. before
 * its first, graded Submit (stored as lessonProgress.mastery_before). Help only
 * comes after a failed Submit, and that failure is BKT's biggest single drop; on
 * live mastery a student who passed every earlier lesson was pushed back to
 * Faded at the very moment they asked. The failure still counts from the next
 * lesson on. Before any Submit on the lesson, live mastery is that same value.
 * Every topic starts at the BKT prior (0.15) for everyone. Decided 2026-10-07.
 */
export function routingMastery(
  current: number | null,
  progress: { mastery_before?: number } | null,
): number | null {
  return progress?.mastery_before ?? current;
}

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
      // The mastery the example type is chosen from (routingMastery).
      bkt_prob_mastery: routingMastery(probMastery, progress),
      // Oldest first, ending with the student's latest message.
      messages: recent.reverse().map((m) => ({ sender: m.sender, content: m.content })),
      failed_submits: progress?.failed_submits ?? 0,
      error_trace: progress?.last_error_trace ?? "",
      example_allowance: await allowanceForChat(ctx, chat),
      // Chats from before groups were stored have none; the server then uses
      // its default (experimental).
      experiment_condition: chat.experiment_condition ?? null,
    };
  },
});
