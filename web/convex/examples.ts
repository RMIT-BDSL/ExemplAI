import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";

/**
 * Example allowance per lesson (research design, option B):
 * - Each failed Submit earns one example, up to EXAMPLE_CAP per round.
 * - "Get help" gives the round's first example; "New example" the rest.
 * - Once the cap is used, the student is told to try another topic. Opening a
 *   different lesson and coming back starts a new round: a failed Submit
 *   re-enables Get help, and so on. The conversation itself is kept.
 *
 * Convex (addMessage), the Python server and the UI all read this one
 * calculation, so the three can't disagree.
 */
export const EXAMPLE_CAP = 3;

export type ExampleAllowance = {
  cap: number;
  used: number; // examples given this round
  earned: number; // examples earned this round (failed Submits, capped)
  remaining: number; // earned - used
  exhausted: boolean; // used the whole cap this round
  helpStarted: boolean; // the tutor has replied at least once in this lesson
};

export async function lessonProgressFor(
  ctx: QueryCtx,
  userId: Id<"users">,
  lessonId: Id<"questions">
) {
  return await ctx.db
    .query("lessonProgress")
    .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonId", lessonId))
    .unique();
}

export function computeAllowance(
  messages: Doc<"chatMessages">[],
  progress: Doc<"lessonProgress"> | null
): ExampleAllowance {
  const roundStart = progress?.round_started_at ?? 0;
  const used = messages.filter(
    (m) =>
      m.sender === "assistant" &&
      m.response_type === "new_example" &&
      m._creationTime > roundStart
  ).length;
  return allowanceFrom(used, progress, messages.some((m) => m.sender === "assistant"));
}

export function allowanceFrom(
  used: number,
  progress: Doc<"lessonProgress"> | null,
  helpStarted: boolean
): ExampleAllowance {
  // Rows from before rounds existed only have the lesson total.
  const roundFailedSubmits = progress?.round_failed_submits ?? progress?.failed_submits ?? 0;
  const earned = Math.min(EXAMPLE_CAP, roundFailedSubmits);
  return {
    cap: EXAMPLE_CAP,
    used,
    earned,
    remaining: Math.max(0, earned - used),
    exhausted: used >= EXAMPLE_CAP,
    helpStarted,
  };
}

/**
 * Examples given this round, read from an index range and capped at
 * EXAMPLE_CAP, so it never loads the conversation. Every allowance rule only
 * compares `used` against the cap, so the capped count gives the same answers.
 */
export async function roundExamplesUsed(
  ctx: QueryCtx,
  chatId: Id<"chats">,
  progress: Doc<"lessonProgress"> | null
) {
  const roundStart = progress?.round_started_at ?? 0;
  const given = await ctx.db
    .query("chatMessages")
    .withIndex("by_chat_response", (q) =>
      q.eq("chatId", chatId).eq("response_type", "new_example").gt("_creationTime", roundStart)
    )
    .take(EXAMPLE_CAP);
  return given.length;
}

/**
 * A fresh chat starts each time a lesson is opened, so a lesson can have
 * several chats. They are returned oldest first; the last is the current one.
 */
export async function lessonChats(ctx: QueryCtx, userId: Id<"users">, lessonId: Id<"questions">) {
  return await ctx.db
    .query("chats")
    .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonId", lessonId))
    .collect();
}

/** Examples given this round across all of a lesson's chats (capped). */
export async function lessonExamplesUsed(
  ctx: QueryCtx,
  chats: Doc<"chats">[],
  progress: Doc<"lessonProgress"> | null
) {
  let used = 0;
  for (const chat of chats) {
    used += await roundExamplesUsed(ctx, chat._id, progress);
    if (used >= EXAMPLE_CAP) return EXAMPLE_CAP;
  }
  return used;
}

/**
 * The allowance is per lesson (it carries over when the lesson is reopened);
 * "help started" is per chat, so every fresh chat starts locked until a tutor
 * reply. `currentChatId` null = no chat open (e.g. openLesson).
 */
export async function allowanceForLesson(
  ctx: QueryCtx,
  userId: Id<"users">,
  lessonId: Id<"questions">,
  currentChatId: Id<"chats"> | null
) {
  const progress = await lessonProgressFor(ctx, userId, lessonId);
  const used = await lessonExamplesUsed(ctx, await lessonChats(ctx, userId, lessonId), progress);
  const reply = currentChatId
    ? await ctx.db
        .query("chatMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", currentChatId))
        .filter((q) => q.eq(q.field("sender"), "assistant"))
        .first()
    : null;
  return allowanceFrom(used, progress, reply !== null);
}

export async function allowanceForChat(ctx: QueryCtx, chat: Doc<"chats">) {
  return await allowanceForLesson(ctx, chat.userId, chat.lessonId, chat._id);
}

/** Why a button turn isn't allowed right now, or null if it is. */
export function buttonBlockedReason(
  trigger: "get_help" | "new_example",
  a: ExampleAllowance
): string | null {
  if (trigger === "get_help") {
    if (a.used > 0) return "Get help has already been used; ask for a new example instead";
    if (a.remaining < 1) return "Get help unlocks after a failed Submit";
    return null;
  }
  if (a.used < 1) return "Use Get help first";
  if (a.exhausted) return "All examples for this lesson are used; try another topic and come back";
  if (a.remaining < 1) return "Submit another attempt to unlock your next example";
  return null;
}

// Allowance for the student's current chat on a lesson (reactive, for the chat UI).
export const getExampleAllowance = authenticatedQuery({
  args: { lessonId: v.id("questions"), chatId: v.optional(v.id("chats")) },
  handler: async (ctx, args): Promise<ExampleAllowance> => {
    if (!ctx.customUser) throw new Error("User not found");
    const userId = ctx.customUser._id;
    let current: Id<"chats"> | null = null;
    if (args.chatId) {
      const chat = await ctx.db.get(args.chatId);
      if (chat && chat.userId === userId && chat.lessonId === args.lessonId) current = chat._id;
    }
    return await allowanceForLesson(ctx, userId, args.lessonId, current);
  },
});

async function resetRound(ctx: MutationCtx, progress: Doc<"lessonProgress">) {
  await ctx.db.patch(progress._id, { round_started_at: Date.now(), round_failed_submits: 0 });
}

/**
 * Called whenever the student opens a lesson. Coming back to a lesson from a
 * different one starts a new example round there if the cap was used up.
 */
export const openLesson = authenticatedMutation({
  args: { lessonId: v.id("questions") },
  handler: async (ctx, args) => {
    if (!ctx.customUser) throw new Error("User not found");
    const user = ctx.customUser;
    if (user.last_opened_lesson === args.lessonId) return { reset: false };

    let reset = false;
    const progress = await lessonProgressFor(ctx, user._id, args.lessonId);
    if (progress && user.last_opened_lesson !== undefined) {
      if ((await allowanceForLesson(ctx, user._id, args.lessonId, null)).exhausted) {
        await resetRound(ctx, progress);
        reset = true;
      }
    }
    await ctx.db.patch(user._id, { last_opened_lesson: args.lessonId });
    return { reset };
  },
});
