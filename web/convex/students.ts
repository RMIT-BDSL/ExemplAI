import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { adminQuery } from "./functions";
import { computeAllowance } from "./examples";

/**
 * Admin view of how students are doing.
 *
 * Definitions (shared by the list and detail views so the numbers agree):
 * - Submitted lesson: completed, or at least one failed Submit. Run never counts.
 * - First-try pass: completed with zero failed Submits.
 * - Mastery is BKT P(L) per knowledge component (KC); a lesson's mastery is its
 *   KC's. Week and overall mastery are averages, computed here, not stored.
 * - Example mode mirrors server/ai/graph_router.py orchestrator_router.
 * - First try by band: each submitted lesson grouped by the student's topic
 *   mastery just before its first Submit (mastery_before), so the outcome
 *   isn't already baked into the mastery it's compared with.
 */

// Roles that are staff, not students; they're left out of every view.
export const STAFF_ROLES = new Set(["admin", "management"]);

export type ExampleMode = "complete" | "faded" | "erroneous";

// Keep in step with orchestrator_router (< 0.3, 0.3-0.7, > 0.7).
export function modeForMastery(mastery: number): ExampleMode {
  if (mastery < 0.3) return "complete";
  if (mastery <= 0.7) return "faded";
  return "erroneous";
}

// The tutor's reply records the node that wrote it (server _determine_chosen_model).
export type ReplyMode = ExampleMode | "control" | "blocked";
export function modeFromModel(model: string | undefined): ReplyMode | null {
  switch (model) {
    case "complete_example_node":
      return "complete";
    case "faded_example_node":
      return "faded";
    case "erroneous_example_node":
      return "erroneous";
    case "control_agent_node":
      return "control";
    case "guardrail_blocked":
      return "blocked";
    default:
      return null;
  }
}

export function isSubmitted(p: Pick<Doc<"lessonProgress">, "status" | "failed_submits">) {
  return p.status === "completed" || (p.failed_submits ?? 0) > 0;
}

export function isFirstTry(p: Pick<Doc<"lessonProgress">, "status" | "failed_submits">) {
  return p.status === "completed" && (p.failed_submits ?? 0) === 0;
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export type BandStat = { band: ExampleMode; lessons: number; firstTry: number };

/** First-try passes per mastery band, over submitted lessons that recorded mastery going in. */
export function firstTryByBand(
  rows: Pick<Doc<"lessonProgress">, "status" | "failed_submits" | "mastery_before">[],
): BandStat[] {
  const out: BandStat[] = (["complete", "faded", "erroneous"] as const).map((band) => ({
    band,
    lessons: 0,
    firstTry: 0,
  }));
  for (const p of rows) {
    if (p.mastery_before === undefined || !isSubmitted(p)) continue;
    const stat = out.find((b) => b.band === modeForMastery(p.mastery_before!))!;
    stat.lessons++;
    if (isFirstTry(p)) stat.firstTry++;
  }
  return out;
}

export function progressActivityAt(p: Doc<"lessonProgress">) {
  return p.updated_at ?? p._creationTime;
}

function isStudent(u: Doc<"users">) {
  return !u.role || !STAFF_ROLES.has(u.role);
}

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
  masteryByKc: Map<string, Doc<"bktMastery">>,
) {
  const chat = await ctx.db
    .query("chats")
    .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonId", lesson._id))
    .unique();
  const messages = chat
    ? await ctx.db
        .query("chatMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
        .collect()
    : [];
  const allowance = computeAllowance(messages, progress);
  const lastReply = [...messages].reverse().find((m) => m.sender === "assistant");
  const mastery = lesson.knowledge_component
    ? masteryByKc.get(lesson.knowledge_component)
    : undefined;

  return {
    ...lessonInfo(lesson),
    status: progress?.status ?? ("pending" as const),
    failedSubmits: progress?.failed_submits ?? 0,
    mastery: mastery?.prob_mastery ?? null,
    mode: mastery ? modeForMastery(mastery.prob_mastery) : null,
    examples: { used: allowance.used, cap: allowance.cap, remaining: allowance.remaining },
    lastReply: lastReply
      ? {
          mode: modeFromModel(lastReply.model),
          responseType: lastReply.response_type ?? null,
          at: lastReply._creationTime,
        }
      : null,
    lastMessageAt: messages.length ? messages[messages.length - 1]._creationTime : null,
  };
}

/**
 * Every student with a one-line summary, plus course-wide first-try rate and
 * how mastery relates to first-try passes.
 */
export const listStudents = adminQuery({
  args: {},
  handler: async (ctx) => {
    const users = (await ctx.db.query("users").collect()).filter(isStudent);
    const lessons = new Map(
      (await ctx.db.query("questions").collect()).map((q) => [q._id, q] as const),
    );

    const allProgress: Doc<"lessonProgress">[] = [];
    let submittedTotal = 0;
    let firstTryTotal = 0;

    const students = [];
    for (const user of users) {
      const progress = await ctx.db
        .query("lessonProgress")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const masteryRows = await ctx.db
        .query("bktMastery")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const masteryByKc = new Map(masteryRows.map((m) => [m.knowledge_component, m] as const));

      const submitted = progress.filter(isSubmitted);
      const firstTry = submitted.filter(isFirstTry);
      const completed = progress.filter((p) => p.status === "completed");
      submittedTotal += submitted.length;
      firstTryTotal += firstTry.length;
      allProgress.push(...progress);

      const overallMastery = mean(masteryRows.map((m) => m.prob_mastery));
      const firstTryRate = submitted.length ? firstTry.length / submitted.length : null;

      const lastLessonDoc = user.last_opened_lesson ? lessons.get(user.last_opened_lesson) : undefined;
      const current = lastLessonDoc
        ? await lessonSnapshot(
            ctx,
            user._id,
            lastLessonDoc,
            progress.find((p) => p.lessonId === lastLessonDoc._id) ?? null,
            masteryByKc,
          )
        : null;

      const lastActivityAt = Math.max(
        0,
        ...progress.map(progressActivityAt),
        ...masteryRows.map((m) => m.updatedAt),
        current?.lastMessageAt ?? 0,
      );

      students.push({
        userId: user._id,
        name: user.name ?? null,
        email: user.email ?? null,
        joinedAt: user._creationTime,
        lastActivityAt: lastActivityAt || null,
        current,
        started: progress.length,
        submitted: submitted.length,
        completed: completed.length,
        firstTry: firstTry.length,
        firstTryRate,
        overallMastery,
        topicsMastered: masteryRows.filter((m) => m.mastered).length,
        topicsTracked: masteryRows.length,
      });
    }

    students.sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0));
    const weekAgo = Date.now() - 7 * 86400_000;

    return {
      students,
      summary: {
        students: students.length,
        active: students.filter((s) => s.started > 0).length,
        activeThisWeek: students.filter((s) => (s.lastActivityAt ?? 0) >= weekAgo).length,
        submitted: submittedTotal,
        firstTry: firstTryTotal,
        firstTryRate: submittedTotal ? firstTryTotal / submittedTotal : null,
        topicsMastered: students.reduce((n, s) => n + s.topicsMastered, 0),
        firstTryByBand: firstTryByBand(allProgress),
      },
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

    // Examples given per lesson (all rounds) plus chat events for the timeline.
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_user_lesson", (q) => q.eq("userId", userId))
      .collect();
    const examplesByLesson = new Map<Id<"questions">, number>();
    type Activity = {
      at: number;
      kind: "started" | "submitted" | "completed" | "mastered" | "help" | "example";
      lessonId: Id<"questions"> | null;
      lessonName: string | null;
      detail: string | null;
    };
    const activity: Activity[] = [];
    const nameOf = (id: Id<"questions">) => lessonById.get(id)?.problem_name ?? "Deleted lesson";

    for (const chat of chats) {
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
        .collect();
      let given = 0;
      for (const m of messages) {
        if (m.sender === "user" && m.trigger) {
          activity.push({
            at: m._creationTime,
            kind: "help",
            lessonId: chat.lessonId,
            lessonName: nameOf(chat.lessonId),
            detail: m.trigger === "get_help" ? "Get help" : "New example",
          });
        }
        if (m.sender === "assistant" && m.response_type === "new_example") {
          given++;
          activity.push({
            at: m._creationTime,
            kind: "example",
            lessonId: chat.lessonId,
            lessonName: nameOf(chat.lessonId),
            detail: modeFromModel(m.model),
          });
        }
      }
      examplesByLesson.set(chat.lessonId, given);
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
      ? await lessonSnapshot(ctx, userId, lastLesson, progressByLesson.get(lastLesson._id) ?? null, masteryByKc)
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
      },
      firstTryByBand: firstTryByBand(progress),
      lessons,
      topics,
      weeks,
      activity: activity.slice(0, 40),
    };
  },
});
