import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { shuffledBlock } from "./experiment";
import { adminMutation, adminQuery, authenticatedMutation, authenticatedQuery, mutation } from "./functions";
import {
  balancedGroups,
  type Group,
  INTAKE_QUESTIONS,
  isValidStudentId,
  normalizeStudentId,
  shuffled,
  studentIdFromEmail,
} from "./studentIds";

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
 * - On first sign-in the student answers a short intake survey.
 */

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
    let participant =
      (await ctx.db.query("cohortParticipants").withIndex("by_user", (q) => q.eq("userId", user._id)).first()) ??
      (await ctx.db
        .query("cohortParticipants")
        .withIndex("by_student_id", (q) => q.eq("studentId", studentId))
        .order("desc")
        .first());
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
          ...(participant.intake ? { intake: participant.intake, intake_at: participant.intake_at } : {}),
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

    await ctx.db.patch(participant._id, {
      userId: user._id,
      joined_at: participant.joined_at ?? now,
      last_login_at: now,
      login_count: (participant.login_count ?? 0) + 1,
    });

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
    return { cohort: cohort.name, onRoster: participant.on_roster, needsIntake: !participant.intake };
  },
});

/** The intake survey questions, and whether this student still has to answer them. */
export const myIntake = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    if (!ctx.customUser) return { needsIntake: false, questions: INTAKE_QUESTIONS };
    const row = await ctx.db
      .query("cohortParticipants")
      .withIndex("by_user", (q) => q.eq("userId", ctx.customUser!._id))
      .first();
    return { needsIntake: !!row && !row.intake, questions: INTAKE_QUESTIONS };
  },
});

export const submitIntake = authenticatedMutation({
  args: { answers: v.record(v.string(), v.string()) },
  handler: async (ctx, { answers }) => {
    if (!ctx.customUser) throw new Error("User not found");
    const row = await ctx.db
      .query("cohortParticipants")
      .withIndex("by_user", (q) => q.eq("userId", ctx.customUser!._id))
      .first();
    if (!row) throw new Error("Not in a cohort");
    const known = new Set<string>(INTAKE_QUESTIONS.map((q) => q.id));
    const clean = Object.fromEntries(
      Object.entries(answers).filter(([k]) => known.has(k)).map(([k, val]) => [k, val.slice(0, 500)]),
    );
    await ctx.db.patch(row._id, { intake: clean, intake_at: Date.now() });
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
          intakeDone: rows.filter((r) => r.intake).length,
          notOnRoster: rows.filter((r) => !r.on_roster).length,
        };
      }),
    );
  },
});

export const roster = adminQuery({
  args: { cohortId: v.id("cohorts") },
  handler: async (ctx, { cohortId }) => {
    const cohort = await ctx.db.get(cohortId);
    if (!cohort) return null;
    const rows = await ctx.db.query("cohortParticipants").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect();
    rows.sort((a, b) => a.studentId.localeCompare(b.studentId));
    return { cohort, participants: rows, questions: INTAKE_QUESTIONS };
  },
});
