import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery, internalMutation } from "./functions";
import { attemptOutcome } from "./schema";
import { type CheckPhase, formFor, stageAt } from "./sessionFlow";
import { flowStateOf, sessionWeekOf } from "./sessionState";
import { DEFAULT_CHECK_MINUTES } from "./studentIds";

/**
 * Quick checks: two short problems before the exercises and two parallel
 * ones after, with the tutor off (decided 2026-10-12; ResearchMethodology.md
 * §5.2). They give each student a pre and post score for the learning-gain
 * analysis. Forms A and B have the same structure and difficulty; half of
 * each group takes A first (cohortParticipants.check_order), so a harder form
 * can't bias the comparison.
 *
 * - The student sees each problem's description and shown example; only the
 *   server's grader reads the hidden tests (getForGrading needs the backend
 *   secret).
 * - Run checks the shown example. Submit is final, one per problem, and the
 *   student doesn't see the result. When the time runs out the page submits
 *   what's in the editor (auto).
 * - Scores don't touch BKT, lesson progress or unlocks.
 *
 * WEEK 4 CONTENT TO CONFIRM: the problems below were written from the rough
 * course outline (week 4 = branching: if/elif/else, comparisons, and/or).
 * Check them against the actual week-4 material before the session.
 */

type Problem = Omit<Doc<"checkProblems">, "_id" | "_creationTime">;

/** Week 4 (Branching). Each form: an if/elif/else ladder with inclusive limits, then an and/or condition. */
export const WEEK4_CHECKS: Problem[] = [
  {
    week: 4,
    form: "A",
    position: 1,
    problem_name: "shippingCost",
    problem_description:
      "Write a function `shippingCost(weight)` that returns the shipping cost for a parcel: **5** if it weighs up to 2 kg, **10** if it weighs over 2 kg and up to 10 kg, and **20** if it weighs over 10 kg.",
    starter_code: "def shippingCost(weight):\n    pass",
    example: { input: "1", expectedOutput: "5" },
    tests: [
      { input: "1", expectedOutput: "5" },
      { input: "2", expectedOutput: "5" },
      { input: "2.5", expectedOutput: "10" },
      { input: "10", expectedOutput: "10" },
      { input: "11", expectedOutput: "20" },
    ],
  },
  {
    week: 4,
    form: "A",
    position: 2,
    problem_name: "canBorrow",
    problem_description:
      "Write a function `canBorrow(age, has_card)` that returns `True` if a person can borrow books from the library, and `False` otherwise. Anyone aged 18 or older can borrow, and people with a library card can borrow from age 12.",
    starter_code: "def canBorrow(age, has_card):\n    pass",
    example: { input: "15, true", expectedOutput: "True" },
    tests: [
      { input: "15, true", expectedOutput: "True" },
      { input: "11, true", expectedOutput: "False" },
      { input: "12, true", expectedOutput: "True" },
      { input: "17, false", expectedOutput: "False" },
      { input: "18, false", expectedOutput: "True" },
    ],
  },
  {
    week: 4,
    form: "B",
    position: 1,
    problem_name: "parkingFee",
    problem_description:
      "Write a function `parkingFee(hours)` that returns the parking fee: **0** for up to 1 hour, **3** for over 1 hour and up to 4 hours, and **8** for over 4 hours.",
    starter_code: "def parkingFee(hours):\n    pass",
    example: { input: "3", expectedOutput: "3" },
    tests: [
      { input: "3", expectedOutput: "3" },
      { input: "1", expectedOutput: "0" },
      { input: "1.5", expectedOutput: "3" },
      { input: "4", expectedOutput: "3" },
      { input: "5", expectedOutput: "8" },
    ],
  },
  {
    week: 4,
    form: "B",
    position: 2,
    problem_name: "canRide",
    problem_description:
      "Write a function `canRide(height, with_adult)` that returns `True` if a child can go on a ride, and `False` otherwise. Children 140 cm or taller can ride alone, and children 120 cm or taller can ride with an adult.",
    starter_code: "def canRide(height, with_adult):\n    pass",
    example: { input: "130, true", expectedOutput: "True" },
    tests: [
      { input: "130, true", expectedOutput: "True" },
      { input: "119, true", expectedOutput: "False" },
      { input: "120, true", expectedOutput: "True" },
      { input: "139, false", expectedOutput: "False" },
      { input: "140, false", expectedOutput: "True" },
    ],
  },
];

/** Add or update the week-4 problems (run once per deployment: `npx convex run quickChecks:seedChecks`). */
export const seedChecks = internalMutation({
  args: {},
  handler: async (ctx) => {
    let added = 0;
    let updated = 0;
    for (const problem of WEEK4_CHECKS) {
      const existing = await ctx.db
        .query("checkProblems")
        .withIndex("by_week_form", (q) =>
          q.eq("week", problem.week).eq("form", problem.form).eq("position", problem.position),
        )
        .unique();
      if (existing) {
        await ctx.db.replace(existing._id, problem);
        updated++;
      } else {
        await ctx.db.insert("checkProblems", problem);
        added++;
      }
    }
    return { added, updated };
  },
});

/** Seconds of grace after a check's time runs out, for the page's own auto-submit. */
const GRACE_MS = 60_000;

async function contextFor(ctx: QueryCtx, user: Doc<"users"> | null) {
  if (!user) return null;
  const p = await ctx.db.query("cohortParticipants").withIndex("by_user", (q) => q.eq("userId", user._id)).first();
  const cohort = p && (await ctx.db.get(p.cohortId));
  if (!p || !cohort) return null;
  return { p, cohort, flow: await flowStateOf(ctx, p, cohort, user) };
}

async function problemsFor(ctx: QueryCtx, week: number, form: "A" | "B") {
  return await ctx.db
    .query("checkProblems")
    .withIndex("by_week_form", (q) => q.eq("week", week).eq("form", form))
    .collect();
}

async function answersOf(ctx: QueryCtx, participantId: Id<"cohortParticipants">) {
  return await ctx.db.query("checkAnswers").withIndex("by_participant", (q) => q.eq("participantId", participantId)).collect();
}

/** The student's current quick check: its problems (without the hidden tests), what's answered, the deadline. */
export const mine = authenticatedQuery({
  args: { phase: v.union(v.literal("pre"), v.literal("post")) },
  handler: async (ctx, { phase }) => {
    const c = await contextFor(ctx, ctx.customUser ?? null);
    if (!c || !c.flow.hasChecks) return null;
    const form = formFor(c.p.check_order, phase);
    const problems = await problemsFor(ctx, sessionWeekOf(c.cohort), form);
    const answered = new Set(
      (await answersOf(ctx, c.p._id)).filter((a) => a.phase === phase).map((a) => a.checkProblemId),
    );
    return {
      minutes: c.cohort.check_minutes ?? DEFAULT_CHECK_MINUTES,
      started: phase === "pre" ? c.flow.preCheckStarted : c.flow.postCheckStarted,
      endsAt: phase === "pre" ? c.flow.timeline.preCheckEndsAt : c.flow.timeline.postCheckEndsAt,
      problems: problems.map((pr) => ({
        _id: pr._id,
        position: pr.position,
        problem_name: pr.problem_name,
        problem_description: pr.problem_description,
        starter_code: pr.starter_code,
        example: pr.example,
        answered: answered.has(pr._id),
      })),
    };
  },
});

/** Start the quick check: its clock starts now. */
export const start = authenticatedMutation({
  args: { phase: v.union(v.literal("pre"), v.literal("post")) },
  handler: async (ctx, { phase }) => {
    const c = await contextFor(ctx, ctx.customUser ?? null);
    if (!c) throw new Error("Not in a cohort");
    if (stageAt(c.flow, Date.now()) !== `${phase}_check`) return;
    const field = phase === "pre" ? "pre_check_started_at" : "post_check_started_at";
    if (c.p[field] === undefined) await ctx.db.patch(c.p._id, { [field]: Date.now() });
  },
});

function checkSecret(secret: string) {
  if (!process.env.CONVEX_BACKEND_SECRET || secret !== process.env.CONVEX_BACKEND_SECRET) {
    throw new Error("Unauthorized: Invalid backend secret");
  }
}

/**
 * Whether this student may submit an answer to this problem now: it's in the
 * form for their current check, not answered yet, and the check is running
 * (or ran out less than GRACE_MS ago).
 */
async function answerable(ctx: QueryCtx, user: Doc<"users"> | null, checkProblemId: Id<"checkProblems">) {
  const c = await contextFor(ctx, user);
  const problem = await ctx.db.get(checkProblemId);
  if (!c || !problem || !c.flow.hasChecks) return null;
  const now = Date.now();
  const stage = stageAt(c.flow, now - GRACE_MS) === "pre_check" || stageAt(c.flow, now) === "pre_check"
    ? "pre_check"
    : stageAt(c.flow, now - GRACE_MS) === "post_check" || stageAt(c.flow, now) === "post_check"
      ? "post_check"
      : null;
  if (!stage) return null;
  const phase: CheckPhase = stage === "pre_check" ? "pre" : "post";
  if (!(phase === "pre" ? c.flow.preCheckStarted : c.flow.postCheckStarted)) return null;
  if (problem.week !== sessionWeekOf(c.cohort) || problem.form !== formFor(c.p.check_order, phase)) return null;
  const existing = await ctx.db
    .query("checkAnswers")
    .withIndex("by_user_problem", (q) => q.eq("userId", user!._id).eq("checkProblemId", checkProblemId))
    .first();
  if (existing) return null;
  return { ...c, problem, phase };
}

/** For the server's grader only: the problem's tests, if the student may answer it now. */
export const getForGrading = authenticatedQuery({
  args: { checkProblemId: v.id("checkProblems"), backendSecret: v.string() },
  handler: async (ctx, { checkProblemId, backendSecret }) => {
    checkSecret(backendSecret);
    const a = await answerable(ctx, ctx.customUser ?? null, checkProblemId);
    if (!a) return null;
    return { starter_code: a.problem.starter_code, tests: a.problem.tests };
  },
});

/** The server's grade for one answer. Finishing both problems ends the check. */
export const recordAnswer = authenticatedMutation({
  args: {
    checkProblemId: v.id("checkProblems"),
    code: v.string(),
    testsPassed: v.number(),
    testsTotal: v.number(),
    outcome: attemptOutcome,
    auto: v.boolean(),
    backendSecret: v.string(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.backendSecret);
    const user = ctx.customUser ?? null;
    const a = await answerable(ctx, user, args.checkProblemId);
    if (!a || !user) throw new Error("This answer can't be accepted now");
    const now = Date.now();
    await ctx.db.insert("checkAnswers", {
      userId: user._id,
      participantId: a.p._id,
      checkProblemId: a.problem._id,
      phase: a.phase,
      form: a.problem.form,
      position: a.problem.position,
      code: args.code.slice(0, 20_000),
      tests_passed: args.testsPassed,
      tests_total: args.testsTotal,
      outcome: args.outcome,
      auto: args.auto,
      ...(user.experiment_condition ? { experiment_condition: user.experiment_condition } : {}),
      submitted_at: now,
    });
    await finishIfComplete(ctx, a.p, a.cohort, a.phase, now);
  },
});

/** Both problems answered: the check ends now (and, after the pre check, the exercise clock starts). */
async function finishIfComplete(
  ctx: MutationCtx,
  p: Doc<"cohortParticipants">,
  cohort: Doc<"cohorts">,
  phase: CheckPhase,
  now: number,
) {
  const problems = await problemsFor(ctx, sessionWeekOf(cohort), formFor(p.check_order, phase));
  const answered = new Set((await answersOf(ctx, p._id)).filter((x) => x.phase === phase).map((x) => x.checkProblemId));
  if (!problems.every((pr) => answered.has(pr._id))) return;
  if (phase === "pre") {
    if (p.pre_check_finished_at !== undefined) return;
    // If time already ran out, the exercises started then, not now.
    const ends = (p.pre_check_started_at ?? now) + (cohort.check_minutes ?? DEFAULT_CHECK_MINUTES) * 60_000;
    const at = Math.min(now, ends);
    await ctx.db.patch(p._id, { pre_check_finished_at: at, exercises_started_at: p.exercises_started_at ?? at });
  } else if (p.post_check_finished_at === undefined) {
    const ends = (p.post_check_started_at ?? now) + (cohort.check_minutes ?? DEFAULT_CHECK_MINUTES) * 60_000;
    await ctx.db.patch(p._id, { post_check_finished_at: Math.min(now, ends) });
  }
}

/**
 * A participant's quick-check scores for the admin roster and export: per
 * problem, tests passed out of its tests (an unanswered problem scores 0),
 * and the check's score 0–100 over all its tests. Null for a check not
 * started.
 */
export async function checkScores(ctx: QueryCtx, p: Doc<"cohortParticipants">, cohort: Doc<"cohorts">) {
  const answers = await answersOf(ctx, p._id);
  const week = sessionWeekOf(cohort);
  const score = async (phase: CheckPhase) => {
    const started = phase === "pre" ? p.pre_check_started_at : p.post_check_started_at;
    if (started === undefined) return null;
    const form = formFor(p.check_order, phase);
    const problems = (await problemsFor(ctx, week, form)).sort((x, y) => x.position - y.position);
    const rows = problems.map((pr) => {
      const a = answers.find((x) => x.checkProblemId === pr._id);
      return {
        problem: pr.problem_name,
        passed: a?.tests_passed ?? 0,
        total: a?.tests_total ?? pr.tests.length,
        answered: !!a,
        auto: a?.auto ?? false,
      };
    });
    const total = rows.reduce((n, r) => n + r.total, 0);
    return {
      form,
      problems: rows,
      score: total ? Math.round((rows.reduce((n, r) => n + r.passed, 0) / total) * 100) : 0,
    };
  };
  return { pre: await score("pre"), post: await score("post") };
}
