import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { conditionToggleEnabled, shuffledBlock } from "./experiment";
import { internalQuery, type QueryCtx } from "./_generated/server";
import { adminMutation, adminQuery, authenticatedMutation, authenticatedQuery, mutation } from "./functions";
import {
  balancedGroups,
  CONSENT_VERSION,
  DEFAULT_EXERCISE_MINUTES,
  DEFAULT_SESSION_WEEK,
  type Group,
  isValidStudentId,
  normalizeStudentId,
  passcodeMatches,
  shuffled,
  studentIdFromEmail,
} from "./studentIds";
import { cleanAnswers, POST_SURVEY, PRE_SURVEY, type SurveyAnswers, surveyQuestions } from "./surveys";

/**
 * Cohorts: a study session's students, tracked by university ID (decided
 * 2026-10-11).
 *
 * - The admin creates a cohort and adds participants by ID (typed or from a
 *   CSV). Each new participant gets a group straight away, keeping the cohort
 *   balanced between experimental and control.
 * - A student signs in with their ID only (studentIds.ts). On every sign-in,
 *   joinWithId links the account to their roster row, gives them a profile
 *   with the cohort's code (so the rest of the app treats the cohort like an
 *   invite code) and their roster group. An ID on no roster still gets in: it
 *   joins the open cohort with on_roster false, for cross-checking later, and
 *   gets a group from that cohort's randomization blocks.
 * - Phase: while the cohort has a class passcode, a visit is part of the
 *   experimental session; once the passcode is cleared, students return with
 *   their ID alone for open practice, keeping their group. Chats, Run/Submit
 *   attempts and time-on-task visits are tagged with the phase.
 * - The session is one linear flow (decided 2026-10-12): consent, pre-survey,
 *   the session week's exercises for a fixed time, post-survey, then a
 *   completion screen. Students see only the session week's lessons
 *   (lessonAccess.ts). In open practice, a student who hasn't yet consented
 *   and answered the pre-survey does that first, then uses the app freely.
 */

// Everything a student records in the session flow, moved together when an
// unlisted row is merged into a roster row and cleared by resetSession.
const SESSION_FIELDS = [
  "consented", "consent_at", "consent_version", "pre_survey", "pre_survey_at",
  "exercises_started_at", "exercises_finished_at", "post_survey", "post_survey_at",
  "pre_survey_draft", "post_survey_draft",
] as const;

/** Agreeing this soon after declining counts as undoing a misclick: the exercise clock restarts. */
const UNDO_DECLINE_MS = 5 * 60_000;

const UNLISTED = { name: "Not on a roster", code: "unlisted" };

function slug(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "cohort";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

async function groupCounts(ctx: MutationCtx, cohortId: Id<"cohorts">): Promise<Record<Group, number>> {
  const rows = await ctx.db.query("cohortParticipants").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect();
  return {
    experimental: rows.filter((r) => r.group === "experimental").length,
    control: rows.filter((r) => r.group === "control").length,
  };
}

/** The cohort an ID on no roster joins: the open one, else "Not on a roster". */
async function cohortForUnlisted(ctx: MutationCtx): Promise<Doc<"cohorts">> {
  const open = await ctx.db.query("cohorts").withIndex("by_open", (q) => q.eq("open", true)).order("desc").first();
  if (open) return open;
  const existing = await ctx.db.query("cohorts").withIndex("by_code", (q) => q.eq("code", UNLISTED.code)).unique();
  if (existing) return existing;
  const id = await ctx.db.insert("cohorts", { ...UNLISTED, open: false, created_at: Date.now() });
  return (await ctx.db.get(id))!;
}

/** A group from the cohort's randomization blocks (as experiment.ensureCondition does). */
async function blockGroup(ctx: MutationCtx, cohortCode: string): Promise<Group> {
  const block = await ctx.db.query("randomizationBlocks").withIndex("by_cohort", (q) => q.eq("cohort", cohortCode)).unique();
  const remaining = block && block.remaining.length > 0 ? block.remaining : shuffledBlock();
  const [group, ...rest] = remaining;
  if (block) await ctx.db.patch(block._id, { remaining: rest });
  else await ctx.db.insert("randomizationBlocks", { cohort: cohortCode, remaining: rest });
  return group;
}

// ── Students ──────────────────────────────────────────────────────────

/**
 * Sign-in check (convex/auth.ts): does `passcode` open the cohort this ID
 * belongs to? That's the cohort of its roster row (or its own earlier row),
 * else the open cohort. A cohort without a passcode lets any ID in. Internal,
 * so passcodes never reach the browser.
 */
export const passcodeAllows = internalQuery({
  args: { studentId: v.string(), passcode: v.optional(v.string()) },
  handler: async (ctx, { studentId, passcode }) => {
    const rows = await ctx.db
      .query("cohortParticipants")
      .withIndex("by_student_id", (q) => q.eq("studentId", normalizeStudentId(studentId)))
      .order("desc")
      .collect();
    const row = rows.find((r) => r.on_roster) ?? rows[0];
    const cohort = row
      ? await ctx.db.get(row.cohortId)
      : await ctx.db.query("cohorts").withIndex("by_open", (q) => q.eq("open", true)).order("desc").first();
    return passcodeMatches(cohort?.passcode, passcode);
  },
});

/**
 * Called after every ID sign-in. Links the account to its participant row
 * (creating one in the open cohort if the ID is on no roster), records the
 * sign-in, and gives the student their profile and group.
 */
export const joinWithId = mutation({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) throw new Error("Unauthenticated");
    const studentId = studentIdFromEmail(authUser.email);
    if (!studentId || !isValidStudentId(studentId)) throw new Error("Not a student-ID account");
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", authUser._id)).unique();
    if (!user) throw new Error("User not found");

    const now = Date.now();
    // Their own row, else an unlinked row for their ID (roster rows first). A
    // row linked to another account (e.g. one since deleted) is never taken over.
    const unlinked = (await ctx.db
      .query("cohortParticipants")
      .withIndex("by_student_id", (q) => q.eq("studentId", studentId))
      .order("desc")
      .collect()).filter((r) => r.userId === undefined);
    let participant: Doc<"cohortParticipants"> | null =
      (await ctx.db.query("cohortParticipants").withIndex("by_user", (q) => q.eq("userId", user._id)).first()) ??
      unlinked.find((r) => r.on_roster) ??
      unlinked[0] ??
      null;
    // Their ID was added to a roster after they first signed in unlisted: move
    // them onto the roster row, keeping the group they already have (so nobody
    // switches condition mid-study) and their sign-ins and survey.
    if (participant && !participant.on_roster) {
      const rosterRow = await ctx.db
        .query("cohortParticipants")
        .withIndex("by_student_id", (q) => q.eq("studentId", studentId))
        .order("desc")
        .filter((q) => q.and(q.eq(q.field("on_roster"), true), q.eq(q.field("userId"), undefined)))
        .first();
      if (rosterRow) {
        await ctx.db.patch(rosterRow._id, {
          group: participant.group,
          joined_at: participant.joined_at,
          last_login_at: participant.last_login_at,
          login_count: participant.login_count,
          ...Object.fromEntries(SESSION_FIELDS.map((f) => [f, participant![f]])),
        });
        await ctx.db.delete(participant._id);
        participant = await ctx.db.get(rosterRow._id);
      }
    }
    let cohort: Doc<"cohorts"> | null = participant ? await ctx.db.get(participant.cohortId) : null;
    if (!participant || !cohort) {
      cohort = await cohortForUnlisted(ctx);
      const group = await blockGroup(ctx, cohort.code);
      const id = await ctx.db.insert("cohortParticipants", {
        cohortId: cohort._id, studentId, group, on_roster: false, added_at: now,
      });
      participant = (await ctx.db.get(id))!;
    }

    // Session while the cohort has a class passcode (every sign-in needed it),
    // open practice once it's cleared. Records written during the visit copy it.
    const phase = cohort.passcode?.trim() ? "session" : "practice";
    await ctx.db.patch(participant._id, {
      userId: user._id,
      joined_at: participant.joined_at ?? now,
      last_login_at: now,
      login_count: (participant.login_count ?? 0) + 1,
      ...(phase === "session"
        ? { session_visits: (participant.session_visits ?? 0) + 1 }
        : { practice_visits: (participant.practice_visits ?? 0) + 1 }),
    });
    if (user.study_phase !== phase) await ctx.db.patch(user._id, { study_phase: phase });

    const profile = await ctx.db.query("userProfiles").withIndex("by_user_id", (q) => q.eq("userId", user._id)).unique();
    if (profile) await ctx.db.patch(profile._id, { invitationCode: cohort.code, tokenIdentifier: authUser._id });
    else await ctx.db.insert("userProfiles", { userId: user._id, tokenIdentifier: authUser._id, invitationCode: cohort.code });

    // The roster group wins over anything assigned before (e.g. by the testing toggle).
    if (user.experiment_condition !== participant.group || user.condition_source !== "roster") {
      await ctx.db.patch(user._id, {
        experiment_condition: participant.group,
        condition_assigned_at: user.condition_assigned_at ?? now,
        condition_source: "roster",
        name: user.name ?? studentId,
      });
    }
    return { cohort: cohort.name, onRoster: participant.on_roster, phase };
  },
});

export type SessionStage = "consent" | "pre_survey" | "exercises" | "post_survey" | "done" | "open";

/** When the student's exercises end: their own time limit, or the cohort's "End now". */
function exercisesEndAt(p: Doc<"cohortParticipants">, cohort: Doc<"cohorts">): number | null {
  if (p.exercises_started_at === undefined) return cohort.exercises_end_at ?? null;
  const own = p.exercises_started_at + (cohort.exercise_minutes ?? DEFAULT_EXERCISE_MINUTES) * 60_000;
  return cohort.exercises_end_at !== undefined ? Math.min(own, cohort.exercises_end_at) : own;
}

/**
 * Where the student is in the flow, not counting the clock: "exercises" turns
 * into "post_survey" (or "done" after declining) once `endsAt` passes, which
 * the page checks itself because a query can't watch the time.
 */
function stageOf(p: Doc<"cohortParticipants">, phase: Doc<"users">["study_phase"]): SessionStage {
  if (p.consented === undefined) return "consent";
  if (p.consented && !p.pre_survey) return "pre_survey";
  if (phase !== "session") return "open";
  if (p.post_survey) return "done";
  if (p.exercises_finished_at !== undefined) return p.consented ? "post_survey" : "done";
  return "exercises";
}

async function myParticipant(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db.query("cohortParticipants").withIndex("by_user", (q) => q.eq("userId", userId)).first();
}

/**
 * The signed-in student's place in the study flow (null: not in a cohort, e.g.
 * staff). `testingGroup` shows their group on screen, only while the testing
 * toggle (CONDITION_TOGGLE=on) is on, never in production.
 */
export const mySession = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    if (!ctx.customUser) return null;
    const p = await myParticipant(ctx, ctx.customUser._id);
    const cohort = p && (await ctx.db.get(p.cohortId));
    if (!p || !cohort) return null;
    const phase = ctx.customUser.study_phase ?? "practice";
    return {
      phase,
      stage: stageOf(p, phase),
      consented: p.consented ?? null,
      endsAt: phase === "session" ? exercisesEndAt(p, cohort) : null,
      sessionWeek: phase === "session" ? (cohort.session_week ?? DEFAULT_SESSION_WEEK) : null,
      testingGroup: conditionToggleEnabled() ? (ctx.customUser.experiment_condition ?? p.group) : null,
      drafts: { pre: p.pre_survey_draft ?? {}, post: p.post_survey_draft ?? {} },
    };
  },
});

async function requireParticipant(ctx: MutationCtx, userId: Id<"users"> | undefined) {
  if (!userId) throw new Error("User not found");
  const p = await myParticipant(ctx, userId);
  if (!p) throw new Error("Not in a cohort");
  return p;
}

/**
 * Agree or decline after reading the consent information. A student who
 * declined can change to agreeing (until their exercises are over); soon
 * after declining, that's taken as undoing a misclick and their exercise
 * clock restarts after the pre-survey.
 */
export const giveConsent = authenticatedMutation({
  args: { agree: v.boolean() },
  handler: async (ctx, { agree }) => {
    const p = await requireParticipant(ctx, ctx.customUser?._id);
    if (p.consented || (p.consented === false && !agree)) return;
    if (p.consented === false && p.exercises_finished_at !== undefined) throw new Error("Today's exercises are over");
    const now = Date.now();
    const inSession = ctx.customUser!.study_phase === "session";
    const undo = p.consented === false && p.consent_at !== undefined && now - p.consent_at < UNDO_DECLINE_MS;
    await ctx.db.patch(p._id, {
      consented: agree,
      consent_at: now,
      consent_version: CONSENT_VERSION,
      // A student who declines may still practise; their clock starts now.
      ...(!agree && inSession && p.exercises_started_at === undefined ? { exercises_started_at: now } : {}),
      ...(undo ? { exercises_started_at: undefined } : {}),
    });
  },
});

/** Save survey answers as the student goes (debounced by the page). */
export const saveSurveyDraft = authenticatedMutation({
  args: { survey: v.union(v.literal("pre"), v.literal("post")), answers: v.record(v.string(), v.union(v.string(), v.array(v.string()))) },
  handler: async (ctx, { survey, answers }) => {
    const p = await requireParticipant(ctx, ctx.customUser?._id);
    if (survey === "pre" ? p.pre_survey : p.post_survey) return;
    // Small and bounded: known ids only, text capped (as on submit).
    const field = survey === "pre" ? "pre_survey_draft" : "post_survey_draft";
    const known = new Set(surveyQuestions(survey === "pre" ? PRE_SURVEY : POST_SURVEY).map((q) => q.id));
    const draft = Object.fromEntries(
      Object.entries(answers)
        .filter(([id]) => known.has(id))
        .map(([id, a]) => [id, Array.isArray(a) ? a.slice(0, 20).map((o) => o.slice(0, 100)) : a.slice(0, 2000)]),
    );
    await ctx.db.patch(p._id, { [field]: draft });
  },
});

const answersValidator = v.record(v.string(), v.union(v.string(), v.array(v.string())));

/** Save the pre-survey; in a session this starts the exercise clock. */
export const submitPreSurvey = authenticatedMutation({
  args: { answers: answersValidator },
  handler: async (ctx, { answers }) => {
    const p = await requireParticipant(ctx, ctx.customUser?._id);
    if (!p.consented) throw new Error("Consent first");
    if (p.pre_survey) return;
    const now = Date.now();
    await ctx.db.patch(p._id, {
      pre_survey: cleanAnswers(PRE_SURVEY, answers as SurveyAnswers),
      pre_survey_at: now,
      pre_survey_draft: undefined,
      ...(ctx.customUser!.study_phase === "session" && p.exercises_started_at === undefined
        ? { exercises_started_at: now }
        : {}),
    });
  },
});

/** "I'm finished": end the exercises before the time is up. */
export const finishExercises = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    const p = await requireParticipant(ctx, ctx.customUser?._id);
    if (p.exercises_finished_at === undefined) await ctx.db.patch(p._id, { exercises_finished_at: Date.now() });
  },
});

export const submitPostSurvey = authenticatedMutation({
  args: { answers: answersValidator },
  handler: async (ctx, { answers }) => {
    const p = await requireParticipant(ctx, ctx.customUser?._id);
    if (!p.consented || !p.pre_survey) throw new Error("Not at the post-survey yet");
    if (p.post_survey) return;
    const now = Date.now();
    // Time ran out (rather than "I'm finished"): the exercises ended then.
    const cohort = await ctx.db.get(p.cohortId);
    const endsAt = cohort ? exercisesEndAt(p, cohort) : null;
    await ctx.db.patch(p._id, {
      post_survey: cleanAnswers(POST_SURVEY, answers as SurveyAnswers),
      post_survey_at: now,
      post_survey_draft: undefined,
      exercises_finished_at: p.exercises_finished_at ?? Math.min(now, endsAt ?? now),
    });
  },
});

// ── Admin ─────────────────────────────────────────────────────────────

export const create = adminMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("A cohort needs a name");
    return await ctx.db.insert("cohorts", {
      name: trimmed, code: slug(trimmed), open: false, created_at: Date.now(),
    });
  },
});

/** Set or clear the session passcode (empty clears it: ID only). */
export const setPasscode = adminMutation({
  args: { cohortId: v.id("cohorts"), passcode: v.string() },
  handler: async (ctx, { cohortId, passcode }) => {
    await ctx.db.patch(cohortId, { passcode: passcode.trim().slice(0, 40) });
  },
});

/** The session's week and exercise time. */
export const setSession = adminMutation({
  args: { cohortId: v.id("cohorts"), session_week: v.number(), exercise_minutes: v.number() },
  handler: async (ctx, { cohortId, session_week, exercise_minutes }) => {
    if (!Number.isInteger(session_week) || session_week < 1 || session_week > 12) throw new Error("Week must be 1 to 12");
    if (!Number.isInteger(exercise_minutes) || exercise_minutes < 1 || exercise_minutes > 120) {
      throw new Error("Exercise time must be 1 to 120 minutes");
    }
    await ctx.db.patch(cohortId, { session_week, exercise_minutes });
  },
});

/** End the exercises for everyone now (they move on to the post-survey), or undo that. */
export const setExercisesEnded = adminMutation({
  args: { cohortId: v.id("cohorts"), ended: v.boolean() },
  handler: async (ctx, { cohortId, ended }) => {
    await ctx.db.patch(cohortId, { exercises_end_at: ended ? Date.now() : undefined });
  },
});

/** Testing: put a participant back at the start of the flow (consent), keeping their sign-ins. */
export const resetSession = adminMutation({
  args: { participantId: v.id("cohortParticipants") },
  handler: async (ctx, { participantId }) => {
    await ctx.db.patch(participantId, Object.fromEntries(SESSION_FIELDS.map((f) => [f, undefined])));
  },
});

/** Make this cohort the one that IDs on no roster join (only one is open). */
export const setOpen = adminMutation({
  args: { cohortId: v.id("cohorts"), open: v.boolean() },
  handler: async (ctx, { cohortId, open }) => {
    if (open) {
      for (const c of await ctx.db.query("cohorts").withIndex("by_open", (q) => q.eq("open", true)).collect()) {
        if (c._id !== cohortId) await ctx.db.patch(c._id, { open: false });
      }
    }
    await ctx.db.patch(cohortId, { open });
  },
});

/**
 * Add participants by ID (typed, or rows from a CSV). New IDs are shuffled
 * and given groups that keep the cohort balanced. IDs already in this cohort
 * are skipped; badly formed IDs are reported.
 */
export const addParticipants = adminMutation({
  args: {
    cohortId: v.id("cohorts"),
    participants: v.array(v.object({ studentId: v.string(), metadata: v.optional(v.record(v.string(), v.string())) })),
  },
  handler: async (ctx, { cohortId, participants }) => {
    if (!(await ctx.db.get(cohortId))) throw new Error("Cohort not found");
    const existing = new Set(
      (await ctx.db.query("cohortParticipants").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect())
        .map((r) => r.studentId),
    );
    const invalid: string[] = [];
    const skipped: string[] = [];
    const fresh = new Map<string, Record<string, string> | undefined>();
    for (const p of participants) {
      const id = normalizeStudentId(p.studentId);
      if (!isValidStudentId(id)) invalid.push(p.studentId);
      else if (existing.has(id) || fresh.has(id)) skipped.push(id);
      else fresh.set(id, p.metadata);
    }
    const ids = shuffled([...fresh.keys()]);
    const groups = balancedGroups(await groupCounts(ctx, cohortId), ids.length);
    const now = Date.now();
    for (let i = 0; i < ids.length; i++) {
      await ctx.db.insert("cohortParticipants", {
        cohortId, studentId: ids[i], group: groups[i], on_roster: true, added_at: now,
        ...(fresh.get(ids[i]) ? { metadata: fresh.get(ids[i]) } : {}),
      });
    }
    return {
      added: ids.length, skipped, invalid,
      experimental: groups.filter((g) => g === "experimental").length,
      control: groups.filter((g) => g === "control").length,
    };
  },
});

/** Remove a participant who hasn't signed in yet. */
export const removeParticipant = adminMutation({
  args: { participantId: v.id("cohortParticipants") },
  handler: async (ctx, { participantId }) => {
    const row = await ctx.db.get(participantId);
    if (!row) return;
    if (row.userId) throw new Error("This student has already signed in; their record is kept");
    await ctx.db.delete(participantId);
  },
});

export const list = adminQuery({
  args: {},
  handler: async (ctx) => {
    const cohorts = await ctx.db.query("cohorts").order("desc").collect();
    return await Promise.all(
      cohorts.map(async (c) => {
        const rows = await ctx.db.query("cohortParticipants").withIndex("by_cohort", (q) => q.eq("cohortId", c._id)).collect();
        return {
          ...c,
          participants: rows.length,
          experimental: rows.filter((r) => r.group === "experimental").length,
          control: rows.filter((r) => r.group === "control").length,
          joined: rows.filter((r) => r.userId).length,
          consented: rows.filter((r) => r.consented).length,
          declined: rows.filter((r) => r.consented === false).length,
          preDone: rows.filter((r) => r.pre_survey).length,
          postDone: rows.filter((r) => r.post_survey).length,
          notOnRoster: rows.filter((r) => !r.on_roster).length,
        };
      }),
    );
  },
});

type UsageSums = { replies: number; input_tokens: number; output_tokens: number; cost_usd: number };

/** A student's tutor usage (tokens, cost) by phase, summed over their tutor replies. */
async function usageByPhase(ctx: QueryCtx, userId: Id<"users">) {
  const zero = (): UsageSums => ({ replies: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 });
  const out = { session: zero(), practice: zero() };
  const chats = await ctx.db.query("chats").withIndex("by_user_lesson", (q) => q.eq("userId", userId)).collect();
  for (const chat of chats) {
    const sums = out[chat.study_phase === "session" ? "session" : "practice"];
    const messages = await ctx.db.query("chatMessages").withIndex("by_chat", (q) => q.eq("chatId", chat._id)).collect();
    for (const m of messages) {
      if (!m.usage) continue;
      sums.replies++;
      sums.input_tokens += m.usage.input_tokens;
      sums.output_tokens += m.usage.output_tokens;
      sums.cost_usd += m.usage.cost_usd ?? 0;
    }
  }
  return out;
}

export const roster = adminQuery({
  args: { cohortId: v.id("cohorts") },
  handler: async (ctx, { cohortId }) => {
    const cohort = await ctx.db.get(cohortId);
    if (!cohort) return null;
    const rows = await ctx.db.query("cohortParticipants").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect();
    rows.sort((a, b) => a.studentId.localeCompare(b.studentId));
    return {
      cohort: {
        ...cohort,
        session_week: cohort.session_week ?? DEFAULT_SESSION_WEEK,
        exercise_minutes: cohort.exercise_minutes ?? DEFAULT_EXERCISE_MINUTES,
      },
      participants: await Promise.all(
        rows.map(async (r) => ({ ...r, usage: r.userId ? await usageByPhase(ctx, r.userId) : null })),
      ),
      preSurvey: PRE_SURVEY,
      postSurvey: POST_SURVEY,
    };
  },
});
