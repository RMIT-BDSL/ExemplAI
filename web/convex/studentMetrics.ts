import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

/**
 * Pure student metrics shared by the admin queries (convex/students.ts) and
 * the summaries kept up to date on every write (convex/triggers.ts). Kept free
 * of function imports so the trigger module can load it without a cycle.
 *
 * - Submitted lesson: completed, or at least one failed Submit. Run never counts.
 * - First-try pass: completed with zero failed Submits.
 * - First try by band: each submitted lesson grouped by the student's topic
 *   mastery just before its first Submit (mastery_before), so the outcome
 *   isn't already baked into the mastery it's compared with.
 */

// Roles that are staff, not students; they're left out of every view.
export const STAFF_ROLES = new Set(["admin", "management"]);

export function isStudent(u: Pick<Doc<"users">, "role">) {
  return !u.role || !STAFF_ROLES.has(u.role);
}

export type ExampleMode = "complete" | "faded" | "erroneous";
export const BANDS = ["complete", "faded", "erroneous"] as const;

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

/**
 * Which tutor wrote a reply. A student's group comes from a PostHog flag on
 * each request (falling back to the normal tutor when the flag can't be read),
 * so the replies, not mastery, say whether they actually got examples.
 */
export const REPLY_KINDS = ["complete", "faded", "erroneous", "control", "blocked", "other"] as const;
export type ReplyKind = (typeof REPLY_KINDS)[number];
export type ReplyCounts = Record<ReplyKind, number>;
export const NO_REPLIES: ReplyCounts = { complete: 0, faded: 0, erroneous: 0, control: 0, blocked: 0, other: 0 };

export function replyKind(model: string | undefined): ReplyKind {
  return modeFromModel(model) ?? "other";
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
  const out: BandStat[] = BANDS.map((band) => ({ band, lessons: 0, firstTry: 0 }));
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

/**
 * Additive counters for one student. A row's contribution is added on insert,
 * subtracted on delete, and (new - old) applied on update, so the stored
 * totals never need a rescan.
 */
export type Counts = {
  started: number;
  submitted: number;
  completed: number;
  firstTry: number;
  topicsTracked: number;
  topicsMastered: number;
  masterySum: number;
  // First try by band, flattened so the counters stay a flat record.
  completeLessons: number;
  completeFirstTry: number;
  fadedLessons: number;
  fadedFirstTry: number;
  erroneousLessons: number;
  erroneousFirstTry: number;
  // Tutor replies by who wrote them (ReplyKind).
  replyComplete: number;
  replyFaded: number;
  replyErroneous: number;
  replyControl: number;
  replyBlocked: number;
  replyOther: number;
};

const REPLY_KEY: Record<ReplyKind, keyof Counts> = {
  complete: "replyComplete",
  faded: "replyFaded",
  erroneous: "replyErroneous",
  control: "replyControl",
  blocked: "replyBlocked",
  other: "replyOther",
};

export const ZERO: Counts = {
  started: 0,
  submitted: 0,
  completed: 0,
  firstTry: 0,
  topicsTracked: 0,
  topicsMastered: 0,
  masterySum: 0,
  completeLessons: 0,
  completeFirstTry: 0,
  fadedLessons: 0,
  fadedFirstTry: 0,
  erroneousLessons: 0,
  erroneousFirstTry: 0,
  replyComplete: 0,
  replyFaded: 0,
  replyErroneous: 0,
  replyControl: 0,
  replyBlocked: 0,
  replyOther: 0,
};

// Validators for Counts, spread into the studentStats / cohortStats schemas.
// Reply counters came later, so rows written before them may lack them (read as 0).
type ReplyCountKey = Extract<keyof Counts, `reply${string}`>;
type StoredCounts = { [K in Exclude<keyof Counts, ReplyCountKey>]: number } & { [K in ReplyCountKey]?: number };
export const countFields = Object.fromEntries(
  Object.keys(ZERO).map((k) => [k, k.startsWith("reply") ? v.optional(v.number()) : v.number()]),
) as unknown as {
  [K in keyof Counts]: K extends `reply${string}`
    ? ReturnType<typeof v.optional<ReturnType<typeof v.number>>>
    : ReturnType<typeof v.number>;
};

export const replyCountFields = v.object(
  Object.fromEntries(REPLY_KINDS.map((k) => [k, v.number()])) as { [K in ReplyKind]: ReturnType<typeof v.number> },
);

export const COUNT_KEYS = Object.keys(ZERO) as (keyof Counts)[];

export function progressCounts(
  p: Pick<Doc<"lessonProgress">, "status" | "failed_submits" | "mastery_before"> | null,
): Counts {
  if (!p) return ZERO;
  const submitted = isSubmitted(p);
  const firstTry = isFirstTry(p);
  const out = {
    ...ZERO,
    started: 1,
    submitted: submitted ? 1 : 0,
    completed: p.status === "completed" ? 1 : 0,
    firstTry: firstTry ? 1 : 0,
  };
  if (submitted && p.mastery_before !== undefined) {
    const band = modeForMastery(p.mastery_before);
    out[`${band}Lessons`] = 1;
    out[`${band}FirstTry`] = firstTry ? 1 : 0;
  }
  return out;
}

export function masteryCounts(m: Pick<Doc<"bktMastery">, "prob_mastery" | "mastered"> | null): Counts {
  if (!m) return ZERO;
  return { ...ZERO, topicsTracked: 1, topicsMastered: m.mastered ? 1 : 0, masterySum: m.prob_mastery };
}

export function addCounts(a: Counts, b: Counts, sign = 1): Counts {
  const out = { ...a };
  for (const k of COUNT_KEYS) out[k] = a[k] + sign * b[k];
  return out;
}

export function isZero(c: Counts) {
  return COUNT_KEYS.every((k) => c[k] === 0);
}

export function pickCounts(c: StoredCounts): Counts {
  const out = { ...ZERO };
  for (const k of COUNT_KEYS) out[k] = c[k] ?? 0;
  return out;
}

export function bandsFromCounts(c: Counts): BandStat[] {
  return BANDS.map((band) => ({ band, lessons: c[`${band}Lessons`], firstTry: c[`${band}FirstTry`] }));
}

/** A chat's reply counts as a Counts delta (chats predating the summary count as none). */
export function chatCounts(chat: { reply_counts?: ReplyCounts } | null): Counts {
  const out = { ...ZERO };
  if (chat?.reply_counts) for (const k of REPLY_KINDS) out[REPLY_KEY[k]] = chat.reply_counts[k];
  return out;
}

export function repliesFromCounts(c: Counts): ReplyCounts {
  const out = { ...NO_REPLIES };
  for (const k of REPLY_KINDS) out[k] = c[REPLY_KEY[k]];
  return out;
}

export function addReplies(a: ReplyCounts, b: ReplyCounts): ReplyCounts {
  const out = { ...a };
  for (const k of REPLY_KINDS) out[k] += b[k];
  return out;
}

export type TutorGroup = "examples" | "control" | "mixed";

/** Which tutor a student has been getting, from their replies (null before any). */
export function tutorGroup(r: ReplyCounts): TutorGroup | null {
  const examples = r.complete + r.faded + r.erroneous;
  if (examples && r.control) return "mixed";
  if (examples) return "examples";
  if (r.control) return "control";
  return null;
}
