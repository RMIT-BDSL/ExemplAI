import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";

/**
 * Study group (A/B) assignment. Each student is assigned once, the first time
 * they open a lesson, and keeps that group: it's stored on the user and copied
 * onto every chat, which the Python server reads (chats:getChatContext).
 *
 * Blocked randomization: within each cohort (the invitation code the student
 * signed up with), groups are handed out from shuffled blocks of BLOCK_SIZE,
 * half experimental and half control, so even a small session stays close to
 * 50/50.
 *
 * For staff testing, setting the Convex environment variable
 * CONDITION_TOGGLE=on shows a group toggle in the workspace and lets
 * setMyCondition change it. Leave it unset in production: the mutation then
 * refuses, so hiding the toggle isn't only cosmetic.
 */
export type ExperimentCondition = "experimental" | "control";

export const BLOCK_SIZE = 4;

/** A fresh block: half of each group, in random order (Fisher–Yates). */
export function shuffledBlock(random: () => number = Math.random): ExperimentCondition[] {
  const block: ExperimentCondition[] = [];
  for (let i = 0; i < BLOCK_SIZE; i++) block.push(i % 2 === 0 ? "experimental" : "control");
  for (let i = block.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [block[i], block[j]] = [block[j], block[i]];
  }
  return block;
}

export function conditionToggleEnabled() {
  return process.env.CONDITION_TOGGLE === "on";
}

async function cohortOf(ctx: MutationCtx, user: Doc<"users">) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .first();
  return profile?.invitationCode ?? "none";
}

/** The student's group, assigning one from their cohort's block if they have none. */
export async function ensureCondition(
  ctx: MutationCtx,
  user: Doc<"users">,
): Promise<ExperimentCondition> {
  if (user.experiment_condition) return user.experiment_condition;

  const cohort = await cohortOf(ctx, user);
  const block = await ctx.db
    .query("randomizationBlocks")
    .withIndex("by_cohort", (q) => q.eq("cohort", cohort))
    .unique();
  const remaining = block && block.remaining.length > 0 ? block.remaining : shuffledBlock();
  const [condition, ...rest] = remaining;
  if (block) await ctx.db.patch(block._id, { remaining: rest });
  else await ctx.db.insert("randomizationBlocks", { cohort, remaining: rest });

  await ctx.db.patch(user._id, {
    experiment_condition: condition,
    condition_assigned_at: Date.now(),
    condition_source: "random",
  });
  return condition;
}

// The student's group (null until their first lesson) and whether the testing
// toggle is on.
export const getMyCondition = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return {
      condition: ctx.customUser?.experiment_condition ?? null,
      toggleEnabled: conditionToggleEnabled(),
    };
  },
});

// Testing toggle: switch the student's own group. The chat on screen follows,
// because startChat opens a fresh chat when the group no longer matches.
export const setMyCondition = authenticatedMutation({
  args: { condition: v.union(v.literal("experimental"), v.literal("control")) },
  handler: async (ctx, args) => {
    if (!conditionToggleEnabled()) throw new Error("The group toggle is turned off");
    if (!ctx.customUser) throw new Error("User not found");
    await ctx.db.patch(ctx.customUser._id, {
      experiment_condition: args.condition,
      condition_assigned_at: Date.now(),
      condition_source: "toggle",
    });
    return { condition: args.condition };
  },
});
