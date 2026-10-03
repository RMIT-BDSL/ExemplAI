import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  type Counts,
  ZERO,
  addCounts,
  chatCounts,
  isStudent,
  NO_REPLIES,
  isZero,
  masteryCounts,
  modeFromModel,
  pickCounts,
  progressActivityAt,
  progressCounts,
  replyKind,
} from "./studentMetrics";

/**
 * Keeps the admin summaries (studentStats, cohortStats, the chats summary
 * fields and chatEvents) in step with the tables they summarise. Every
 * mutation is built on the wrapped `mutation` / `internalMutation` in
 * convex/functions.ts, so a write anywhere runs these in the same
 * transaction. Writes made with a raw ctx (convex-test `t.run`, the dashboard)
 * skip them; students:backfillSummaries puts things right afterwards.
 */
export const triggers = new Triggers<DataModel>();

type Ctx = Pick<MutationCtx, "db">;

const started = (c: Pick<Counts, "started">) => (c.started > 0 ? 1 : 0);

async function statsRow(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db
    .query("studentStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function applyToCohort(ctx: Ctx, delta: Counts, students: number, active: number) {
  if (isZero(delta) && students === 0 && active === 0) return;
  const row = await ctx.db.query("cohortStats").first();
  if (!row) {
    await ctx.db.insert("cohortStats", { students, active, ...delta });
    return;
  }
  await ctx.db.patch(row._id, {
    students: row.students + students,
    active: row.active + active,
    ...addCounts(pickCounts(row), delta),
  });
}

/** Counts one student from scratch. Bounded by their lessons, topics and chats. */
async function countStudent(ctx: Ctx, userId: Id<"users">) {
  const progress = await ctx.db
    .query("lessonProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const mastery = await ctx.db
    .query("bktMastery")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const chats = await ctx.db
    .query("chats")
    .withIndex("by_user_lesson", (q) => q.eq("userId", userId))
    .collect();
  let counts = ZERO;
  for (const p of progress) counts = addCounts(counts, progressCounts(p));
  for (const m of mastery) counts = addCounts(counts, masteryCounts(m));
  for (const c of chats) counts = addCounts(counts, chatCounts(c));
  const lastActivityAt = Math.max(
    0,
    ...progress.map(progressActivityAt),
    ...mastery.map((m) => m.updatedAt),
    ...chats.map((c) => c.last_message_at ?? 0),
  );
  return { counts, lastActivityAt };
}

/**
 * Makes a student's stats row match their data and moves the cohort totals by
 * the difference. Removes the row when the user is gone or is staff.
 */
export async function syncStudent(ctx: Ctx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  const row = await statsRow(ctx, userId);
  if (!user || !isStudent(user)) {
    if (!row) return;
    await ctx.db.delete(row._id);
    await applyToCohort(ctx, addCounts(ZERO, pickCounts(row), -1), -1, -started(row));
    return;
  }
  const fresh = await countStudent(ctx, userId);
  const old = row ? pickCounts(row) : ZERO;
  if (row) {
    await ctx.db.patch(row._id, {
      ...fresh.counts,
      lastActivityAt: Math.max(row.lastActivityAt, fresh.lastActivityAt),
    });
  } else {
    await ctx.db.insert("studentStats", { userId, lastActivityAt: fresh.lastActivityAt, ...fresh.counts });
  }
  await applyToCohort(
    ctx,
    addCounts(fresh.counts, old, -1),
    row ? 0 : 1,
    started(fresh.counts) - (row ? started(row) : 0),
  );
}

/** Applies one row's change to its student, or counts them afresh if they have no stats yet. */
async function applyToStudent(ctx: Ctx, userId: Id<"users">, delta: Counts, at: number | null) {
  const row = await statsRow(ctx, userId);
  if (!row) {
    // The write has already happened, so a fresh count includes it.
    await syncStudent(ctx, userId);
    return;
  }
  const lastActivityAt = Math.max(row.lastActivityAt, at ?? 0);
  if (isZero(delta) && lastActivityAt === row.lastActivityAt) return;
  const next = addCounts(pickCounts(row), delta);
  await ctx.db.patch(row._id, { ...next, lastActivityAt });
  await applyToCohort(ctx, delta, 0, started(next) - started(row));
}

function chatEventFor(chat: Doc<"chats">, m: Doc<"chatMessages">) {
  const base = { userId: chat.userId, chatId: chat._id, lessonId: chat.lessonId, messageId: m._id, at: m._creationTime };
  if (m.sender === "user" && m.trigger) {
    return { ...base, kind: "help" as const, detail: m.trigger === "get_help" ? "Get help" : "New example" };
  }
  if (m.sender === "assistant" && m.response_type === "new_example") {
    return { ...base, kind: "example" as const, detail: modeFromModel(m.model) ?? undefined };
  }
  return null;
}

/** Rebuilds a chat's summary fields and events from its messages (one-off per chat). */
export async function rebuildChat(ctx: Ctx, chat: Doc<"chats">) {
  const messages = await ctx.db
    .query("chatMessages")
    .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
    .collect();
  for (const e of await ctx.db
    .query("chatEvents")
    .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
    .collect()) {
    await ctx.db.delete(e._id);
  }
  for (const m of messages) {
    const event = chatEventFor(chat, m);
    if (event) await ctx.db.insert("chatEvents", event);
  }
  const lastReply = [...messages].reverse().find((m) => m.sender === "assistant");
  const replyCounts = { ...NO_REPLIES };
  for (const m of messages) if (m.sender === "assistant") replyCounts[replyKind(m.model)]++;
  await ctx.db.patch(chat._id, {
    reply_counts: replyCounts,
    message_count: messages.length,
    last_message_at: messages.at(-1)?._creationTime,
    last_reply_at: lastReply?._creationTime,
    last_reply_model: lastReply?.model,
    last_reply_response_type: lastReply?.response_type,
    examples_given: messages.filter((m) => m.sender === "assistant" && m.response_type === "new_example").length,
  });
}

triggers.register("lessonProgress", async (ctx, change) => {
  const doc = change.newDoc ?? change.oldDoc;
  const delta = addCounts(progressCounts(change.newDoc), progressCounts(change.oldDoc), -1);
  await applyToStudent(ctx, doc.userId, delta, change.newDoc ? progressActivityAt(change.newDoc) : null);
});

triggers.register("bktMastery", async (ctx, change) => {
  const doc = change.newDoc ?? change.oldDoc;
  const delta = addCounts(masteryCounts(change.newDoc), masteryCounts(change.oldDoc), -1);
  await applyToStudent(ctx, doc.userId, delta, change.newDoc?.updatedAt ?? null);
});

triggers.register("users", async (ctx, change) => {
  // Only joining, leaving, or a role change moves someone in or out of the cohort.
  if (change.operation === "update" && change.oldDoc.role === change.newDoc.role) return;
  await syncStudent(ctx, change.id);
});

triggers.register("chatMessages", async (ctx, change) => {
  if (change.operation === "update") return;
  const chat = await ctx.db.get(change.newDoc?.chatId ?? change.oldDoc!.chatId);
  if (!chat) return;

  if (change.operation === "delete") {
    const m = change.oldDoc;
    for (const e of await ctx.db
      .query("chatEvents")
      .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
      .filter((q) => q.eq(q.field("messageId"), m._id))
      .collect()) {
      await ctx.db.delete(e._id);
    }
    if (chat.message_count !== undefined) {
      const wasExample = m.sender === "assistant" && m.response_type === "new_example";
      const replyCounts =
        chat.reply_counts && m.sender === "assistant"
          ? { ...chat.reply_counts, [replyKind(m.model)]: Math.max(0, chat.reply_counts[replyKind(m.model)] - 1) }
          : chat.reply_counts;
      await ctx.db.patch(chat._id, {
        message_count: Math.max(0, chat.message_count - 1),
        examples_given: Math.max(0, (chat.examples_given ?? 0) - (wasExample ? 1 : 0)),
        reply_counts: replyCounts,
      });
    }
  } else {
    const m = change.newDoc;
    if (chat.message_count === undefined || chat.reply_counts === undefined) {
      // First message since (this part of) the summary existed: count the whole chat once.
      await rebuildChat(ctx, chat);
    } else {
      const isReply = m.sender === "assistant";
      await ctx.db.patch(chat._id, {
        message_count: chat.message_count + 1,
        last_message_at: m._creationTime,
        ...(isReply
          ? {
              last_reply_at: m._creationTime,
              last_reply_model: m.model,
              last_reply_response_type: m.response_type,
              reply_counts: { ...chat.reply_counts, [replyKind(m.model)]: chat.reply_counts[replyKind(m.model)] + 1 },
            }
          : {}),
        ...(isReply && m.response_type === "new_example" ? { examples_given: (chat.examples_given ?? 0) + 1 } : {}),
      });
      const event = chatEventFor(chat, m);
      if (event) await ctx.db.insert("chatEvents", event);
    }
  }

  // The student's reply mix moves by however much this chat's counts moved.
  const after = await ctx.db.get(chat._id);
  const delta = addCounts(chatCounts(after), chatCounts(chat), -1);
  await applyToStudent(ctx, chat.userId, delta, change.newDoc?._creationTime ?? null);
});

triggers.register("chats", async (ctx, change) => {
  if (change.operation !== "delete") return;
  for (const e of await ctx.db
    .query("chatEvents")
    .withIndex("by_chat", (q) => q.eq("chatId", change.id))
    .collect()) {
    await ctx.db.delete(e._id);
  }
  // Replies still counted in a deleted chat leave the student's mix.
  const delta = addCounts(ZERO, chatCounts(change.oldDoc), -1);
  if (!isZero(delta)) await applyToStudent(ctx, change.oldDoc.userId, delta, null);
});
