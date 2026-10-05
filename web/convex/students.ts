import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { allowanceFrom, lessonChats, lessonExamplesUsed } from "./examples";
import { adminQuery, internalMutation } from "./functions";
import {
  ZERO,
  addCounts,
  bandsFromCounts,
  countFields,
  firstTryByBand,
  isFirstTry,
  isStudent,
  isSubmitted,
  mean,
  modeForMastery,
  modeFromModel,
  pickCounts,
  progressActivityAt,
  NO_REPLIES,
  addReplies,
  repliesFromCounts,
  tutorGroup,
} from "./studentMetrics";
import { rebuildChat, syncStudent } from "./triggers";

/**
 * Admin view of how students are doing. Metric definitions live in
 * convex/studentMetrics.ts so the list, detail and stored summaries agree.
 *
 * Reads stay bounded as the cohort and chats grow: the list pages through
 * studentStats, cohort totals come from the single cohortStats row, and chat
 * details come from the summary fields on `chats` and from chatEvents, never
 * from a whole conversation. convex/triggers.ts keeps all of those current.
 */

// Students per page of the list; each one costs a handful of indexed reads.
const MAX_PAGE = 100;
// Counting "active this week" stops here rather than reading every student.
export const ACTIVE_WEEK_CAP = 1000;
const ACTIVITY_LIMIT = 40;

type LessonInfo = {
  lessonId: Id<"questions">;
  name: string;
  week: number;
  topic: string | null;
  kc: string | null;
  courseId: Id<"course">;
};

function lessonInfo(q: Doc<"questions">): LessonInfo {
  return {
    lessonId: q._id,
    name: q.problem_name,
    week: q.week,
    topic: q.topic ?? null,
    kc: q.knowledge_component ?? null,
    courseId: q.course,
  };
}

/** The "test view" for one lesson: status, examples this round, last tutor reply. */
async function lessonSnapshot(
  ctx: QueryCtx,
  userId: Id<"users">,
  lesson: Doc<"questions">,
  progress: Doc<"lessonProgress"> | null,
  mastery: Doc<"bktMastery"> | null,
) {
  // A fresh chat starts each time the lesson is opened: count examples across
  // all of them, and show the latest reply / message from any of them.
  const chats = await lessonChats(ctx, userId, lesson._id);
  const used = await lessonExamplesUsed(ctx, chats, progress);
  const chat =
    chats
      .filter((c) => c.last_reply_at !== undefined)
      .sort((a, b) => (b.last_reply_at ?? 0) - (a.last_reply_at ?? 0))[0] ?? null;
  const allowance = allowanceFrom(used, progress, chat !== null);

  return {
    ...lessonInfo(lesson),
    status: progress?.status ?? ("pending" as const),
    failedSubmits: progress?.failed_submits ?? 0,
    mastery: mastery?.prob_mastery ?? null,
    mode: mastery ? modeForMastery(mastery.prob_mastery) : null,
    examples: { used: allowance.used, cap: allowance.cap, remaining: allowance.remaining },
    lastReply:
      chat?.last_reply_at !== undefined
        ? {
            mode: modeFromModel(chat.last_reply_model),
            responseType: chat.last_reply_response_type ?? null,
            at: chat.last_reply_at,
          }
        : null,
    lastMessageAt: chats.reduce<number | null>(
      (latest, c) => (c.last_message_at !== undefined && (latest === null || c.last_message_at > latest) ? c.last_message_at : latest),
      null,
    ),
  };
}

/** One list row: the stored counters plus a snapshot of the lesson opened last. */
async function studentRow(ctx: QueryCtx, stats: Doc<"studentStats">) {
  const user = await ctx.db.get(stats.userId);
  if (!user || !isStudent(user)) return null;

  const lesson = user.last_opened_lesson ? await ctx.db.get(user.last_opened_lesson) : null;
  let current = null;
  const replies = repliesFromCounts(pickCounts(stats));
  if (lesson) {
    const progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user_lesson", (q) => q.eq("userId", user._id).eq("lessonId", lesson._id))
      .unique();
    const kc = lesson.knowledge_component;
    const mastery = kc
      ? await ctx.db
          .query("bktMastery")
          .withIndex("by_user_kc", (q) => q.eq("userId", user._id).eq("knowledge_component", kc))
          .unique()
      : null;
    current = await lessonSnapshot(ctx, user._id, lesson, progress, mastery);
  }

  return {
    userId: user._id,
    name: user.name ?? null,
    email: user.email ?? null,
    joinedAt: user._creationTime,
    lastActivityAt: stats.lastActivityAt || null,
    current,
    started: stats.started,
    submitted: stats.submitted,
    completed: stats.completed,
    firstTry: stats.firstTry,
    firstTryRate: stats.submitted ? stats.firstTry / stats.submitted : null,
    overallMastery: stats.topicsTracked ? stats.masterySum / stats.topicsTracked : null,
    topicsMastered: stats.topicsMastered,
    topicsTracked: stats.topicsTracked,
    replies,
    tutor: tutorGroup(replies),
  };
}

/** Students, most recently active first, one page at a time. */
export const listStudents = adminQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query("studentStats")
      .withIndex("by_last_activity")
      .order("desc")
      .paginate({ ...paginationOpts, numItems: Math.min(paginationOpts.numItems, MAX_PAGE) });
    const rows = await Promise.all(result.page.map((stats) => studentRow(ctx, stats)));
    return { ...result, page: rows.filter((r) => r !== null) };
  },
});

/** Course-wide totals and how mastery relates to first-try passes. */
export const studentSummary = adminQuery({
  args: {},
  handler: async (ctx) => {
    const c = await ctx.db.query("cohortStats").first();
    const counts = c ? pickCounts(c) : ZERO;
    const weekAgo = Date.now() - 7 * 86400_000;
    const recent = await ctx.db
      .query("studentStats")
      .withIndex("by_last_activity", (q) => q.gte("lastActivityAt", weekAgo))
      .take(ACTIVE_WEEK_CAP + 1);

    return {
      students: c?.students ?? 0,
      active: c?.active ?? 0,
      activeThisWeek: Math.min(recent.length, ACTIVE_WEEK_CAP),
      activeThisWeekCapped: recent.length > ACTIVE_WEEK_CAP,
      submitted: counts.submitted,
      firstTry: counts.firstTry,
      firstTryRate: counts.submitted ? counts.firstTry / counts.submitted : null,
      topicsMastered: counts.topicsMastered,
      firstTryByBand: bandsFromCounts(counts),
      replies: repliesFromCounts(counts),
    };
  },
});

/** One student's progress by lesson, mastery by topic, and recent activity. */
export const getStudent = adminQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user || !isStudent(user)) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
    const progress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const masteryRows = await ctx.db
      .query("bktMastery")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const masteryByKc = new Map(masteryRows.map((m) => [m.knowledge_component, m] as const));
    const progressByLesson = new Map(progress.map((p) => [p.lessonId, p] as const));
    const allLessons = await ctx.db.query("questions").collect();
    const lessonById = new Map(allLessons.map((q) => [q._id, q] as const));
    const courses = new Map(
      (await ctx.db.query("course").collect()).map((c) => [c._id, c.course_name] as const),
    );

    // At most one chat per lesson; the counts come from its summary fields.
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_user_lesson", (q) => q.eq("userId", userId))
      .collect();
    const examplesByLesson = new Map(chats.map((c) => [c.lessonId, c.examples_given ?? 0] as const));
    const replies = chats.reduce((sum, c) => addReplies(sum, c.reply_counts ?? NO_REPLIES), NO_REPLIES);

    type Activity = {
      at: number;
      kind: "started" | "submitted" | "completed" | "mastered" | "help" | "example";
      lessonId: Id<"questions"> | null;
      lessonName: string | null;
      detail: string | null;
    };
    const activity: Activity[] = [];
    const nameOf = (id: Id<"questions">) => lessonById.get(id)?.problem_name ?? "Deleted lesson";

    const chatEvents = await ctx.db
      .query("chatEvents")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(ACTIVITY_LIMIT);
    for (const e of chatEvents) {
      activity.push({ at: e.at, kind: e.kind, lessonId: e.lessonId, lessonName: nameOf(e.lessonId), detail: e.detail ?? null });
    }

    for (const p of progress) {
      activity.push({ at: p._creationTime, kind: "started", lessonId: p.lessonId, lessonName: nameOf(p.lessonId), detail: null });
      if (p.completed_at) {
        activity.push({
          at: p.completed_at,
          kind: "completed",
          lessonId: p.lessonId,
          lessonName: nameOf(p.lessonId),
          detail: isFirstTry(p) ? "first try" : `after ${p.failed_submits} failed Submit${p.failed_submits === 1 ? "" : "s"}`,
        });
      } else if (p.last_submit_at && p.status !== "completed") {
        activity.push({
          at: p.last_submit_at,
          kind: "submitted",
          lessonId: p.lessonId,
          lessonName: nameOf(p.lessonId),
          detail: `${p.failed_submits ?? 0} failed so far`,
        });
      }
    }
    for (const m of masteryRows) {
      if (m.mastered && m.masteredAt) {
        activity.push({ at: m.masteredAt, kind: "mastered", lessonId: null, lessonName: null, detail: m.knowledge_component });
      }
    }
    activity.sort((a, b) => b.at - a.at);

    const lessons = allLessons
      .map((q) => {
        const p = progressByLesson.get(q._id);
        const m = q.knowledge_component ? masteryByKc.get(q.knowledge_component) : undefined;
        return {
          ...lessonInfo(q),
          courseName: courses.get(q.course) ?? null,
          status: p?.status ?? ("pending" as const),
          failedSubmits: p?.failed_submits ?? 0,
          submitted: p ? isSubmitted(p) : false,
          firstTry: p ? isFirstTry(p) : false,
          examplesGiven: examplesByLesson.get(q._id) ?? 0,
          mastery: m?.prob_mastery ?? null,
          masteryBefore: p?.mastery_before ?? null,
          lastActivityAt: p ? progressActivityAt(p) : null,
        };
      })
      .sort((a, b) => a.week - b.week || a.name.localeCompare(b.name));

    const topics = masteryRows
      .map((m) => {
        const inTopic = lessons.filter((l) => l.kc === m.knowledge_component);
        return {
          kc: m.knowledge_component,
          topic: inTopic.find((l) => l.topic)?.topic ?? null,
          mastery: m.prob_mastery,
          mode: modeForMastery(m.prob_mastery),
          mastered: m.mastered ?? false,
          masteredAt: m.masteredAt ?? null,
          updatedAt: m.updatedAt,
          lessons: inTopic.length,
          completed: inTopic.filter((l) => l.status === "completed").length,
          submitted: inTopic.filter((l) => l.submitted).length,
          firstTry: inTopic.filter((l) => l.firstTry).length,
        };
      })
      .sort((a, b) => a.mastery - b.mastery);

    const weekNumbers = [...new Set(lessons.map((l) => l.week))].sort((a, b) => a - b);
    const weeks = weekNumbers.map((week) => {
      const inWeek = lessons.filter((l) => l.week === week);
      return {
        week,
        lessons: inWeek.length,
        started: inWeek.filter((l) => l.status !== "pending").length,
        completed: inWeek.filter((l) => l.status === "completed").length,
        submitted: inWeek.filter((l) => l.submitted).length,
        firstTry: inWeek.filter((l) => l.firstTry).length,
        // Lesson-weighted mean of the KC mastery behind this week's lessons.
        mastery: mean(inWeek.flatMap((l) => (l.mastery === null ? [] : [l.mastery]))),
        topics: [...new Set(inWeek.flatMap((l) => (l.kc ? [l.kc] : [])))],
      };
    });

    const lastLesson = user.last_opened_lesson ? lessonById.get(user.last_opened_lesson) : undefined;
    const current = lastLesson
      ? await lessonSnapshot(
          ctx,
          userId,
          lastLesson,
          progressByLesson.get(lastLesson._id) ?? null,
          (lastLesson.knowledge_component && masteryByKc.get(lastLesson.knowledge_component)) || null,
        )
      : null;

    const submitted = lessons.filter((l) => l.submitted);
    const firstTry = submitted.filter((l) => l.firstTry);

    return {
      student: {
        userId: user._id,
        name: user.name ?? null,
        email: user.email ?? null,
        joinedAt: user._creationTime,
        invitationCode: profile?.invitationCode ?? null,
      },
      current,
      totals: {
        lessons: lessons.length,
        started: progress.length,
        completed: lessons.filter((l) => l.status === "completed").length,
        submitted: submitted.length,
        firstTry: firstTry.length,
        firstTryRate: submitted.length ? firstTry.length / submitted.length : null,
        overallMastery: mean(masteryRows.map((m) => m.prob_mastery)),
        topicsMastered: masteryRows.filter((m) => m.mastered).length,
        topicsTracked: masteryRows.length,
        examplesGiven: [...examplesByLesson.values()].reduce((a, b) => a + b, 0),
        replies,
        tutor: tutorGroup(replies),
      },
      firstTryByBand: firstTryByBand(progress),
      lessons,
      topics,
      weeks,
      activity: activity.slice(0, ACTIVITY_LIMIT),
    };
  },
});

const BACKFILL_BATCH = 20;

/**
 * Builds the summaries from existing data, a batch per transaction so each one
 * stays within Convex's read limits: chat summaries first (student activity
 * reads them), then each student's stats, then the cohort totals recounted
 * from those. Safe to re-run; live writes keep going meanwhile.
 *
 *   npx convex run students:backfillSummaries
 */
export const backfillSummaries = internalMutation({
  args: {
    phase: v.optional(v.union(v.literal("chats"), v.literal("students"), v.literal("cohort"))),
    cursor: v.optional(v.union(v.string(), v.null())),
    totals: v.optional(v.object({ students: v.number(), active: v.number(), counts: v.object(countFields) })),
  },
  handler: async (ctx, args) => {
    const phase = args.phase ?? "chats";
    const cursor = args.cursor ?? null;
    const next = (fields: { phase: "chats" | "students" | "cohort"; cursor: string | null; totals?: typeof args.totals }) =>
      ctx.scheduler.runAfter(0, internal.students.backfillSummaries, fields);

    if (phase === "chats") {
      const { page, isDone, continueCursor } = await ctx.db
        .query("chats")
        .paginate({ cursor, numItems: BACKFILL_BATCH });
      for (const chat of page) await rebuildChat(ctx, chat);
      await next(isDone ? { phase: "students", cursor: null } : { phase, cursor: continueCursor });
      return { phase, processed: page.length };
    }

    if (phase === "students") {
      const { page, isDone, continueCursor } = await ctx.db
        .query("users")
        .paginate({ cursor, numItems: BACKFILL_BATCH });
      for (const user of page) await syncStudent(ctx, user._id);
      await next(isDone ? { phase: "cohort", cursor: null } : { phase, cursor: continueCursor });
      return { phase, processed: page.length };
    }

    // Recount the cohort from the stats rows, dropping rows whose user is gone.
    const totals = args.totals ?? { students: 0, active: 0, counts: ZERO };
    const { page, isDone, continueCursor } = await ctx.db
      .query("studentStats")
      .paginate({ cursor, numItems: BACKFILL_BATCH * 5 });
    for (const row of page) {
      const user = await ctx.db.get(row.userId);
      if (!user || !isStudent(user)) {
        await ctx.db.delete(row._id);
        continue;
      }
      totals.students++;
      if (row.started > 0) totals.active++;
      totals.counts = addCounts(pickCounts(totals.counts), pickCounts(row));
    }
    if (!isDone) {
      await next({ phase, cursor: continueCursor, totals });
      return { phase, processed: page.length };
    }
    const fields = { students: totals.students, active: totals.active, ...totals.counts };
    const existing = await ctx.db.query("cohortStats").collect();
    if (existing.length) {
      await ctx.db.replace(existing[0]._id, fields);
      for (const extra of existing.slice(1)) await ctx.db.delete(extra._id);
    } else {
      await ctx.db.insert("cohortStats", fields);
    }
    return { phase, processed: page.length, done: true };
  },
});
