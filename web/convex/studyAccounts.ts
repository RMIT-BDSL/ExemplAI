import { v } from "convex/values";
import { hashPassword } from "better-auth/crypto";
import { internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";
import { createAuth } from "./auth";
import { internalMutation } from "./functions";
import { balancedGroups, type Group, shuffled } from "./studentIds";

/**
 * Pre-made study accounts (decided 2026-11-10), created by
 * web/scripts/create-study-accounts.mjs. Email: group letter + number at
 * EMAIL_DOMAIN (`c07@socratestutor.rmit.edu.vn`), random password, signed in
 * on the email + password form.
 *
 * - P: pilot test. Group randomized in blocks of 4 (experiment.ensureCondition)
 *   the first time they open a lesson, so 4 pilots split 2/2.
 * - C: control, the four tutorial classes' students (plain tutor).
 * - E: experimental, all features (example-based tutor).
 *
 * Each group's key (GROUPS[...].key) goes on the account's
 * userProfiles.invitationCode, like an invite code does: it groups the
 * accounts and keys their randomization block. C and E get their group set
 * on the account now, so it never changes.
 *
 * Instead of accounts, the script can make single-use invite codes
 * (createInviteCodes), numbered the same way, for students to sign up with
 * their own email.
 */

export const EMAIL_DOMAIN = "socratestutor.rmit.edu.vn";

const prefix = v.union(v.literal("P"), v.literal("C"), v.literal("E"));
type Prefix = "P" | "C" | "E";

const GROUPS: Record<Prefix, { key: string; group: Group | null }> = {
  P: { key: "study-pilot", group: null },
  C: { key: "study-control", group: "control" },
  E: { key: "study-experimental", group: "experimental" },
};

const accountEmail = (p: Prefix, n: number) => `${p.toLowerCase()}${String(n).padStart(2, "0")}@${EMAIL_DOMAIN}`;

/** The next free account number in the group. */
export const nextNumber = internalQuery({
  args: { prefix },
  handler: async (ctx, { prefix }) => {
    const profiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_invitation_code", (q) => q.eq("invitationCode", GROUPS[prefix].key))
      .collect();
    let max = 0;
    for (const p of profiles) {
      const email = (await ctx.db.get(p.userId))?.email ?? "";
      const m = new RegExp(`^${prefix.toLowerCase()}(\\d+)@`).exec(email);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return max + 1;
  },
});

/**
 * One account. Made the way sign-up makes it (same user + credential account,
 * same onCreate trigger), but without the sign-up hook, which would ask for an
 * invite code.
 */
export const createOne = internalMutation({
  args: { prefix, email: v.string(), passwordHash: v.string() },
  handler: async (ctx, { prefix, email, passwordHash }) => {
    if (await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).first()) {
      throw new Error(`${email} already exists`);
    }
    const auth = await createAuth(ctx).$context;
    const name = email.split("@")[0].toUpperCase();
    const authUser = await auth.internalAdapter.createUser({ email, name, emailVerified: false });
    await auth.internalAdapter.linkAccount({
      userId: authUser.id, providerId: "credential", accountId: authUser.id, password: passwordHash,
    });

    // The onCreate trigger (auth.ts) has just added the app's user row.
    const user = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (!user) throw new Error(`User row for ${email} missing`);
    const { key, group } = GROUPS[prefix];
    await ctx.db.insert("userProfiles", { userId: user._id, tokenIdentifier: authUser.id, invitationCode: key });
    if (group) {
      await ctx.db.patch(user._id, { experiment_condition: group, condition_assigned_at: Date.now(), condition_source: "roster" });
    }
    return { email, name, group: group ?? "random (at first lesson)" };
  },
});

/**
 * One account per password, numbered after the group's existing ones. A failed
 * account is reported and the rest go on, so no created password is lost.
 */
export const createAccounts = internalAction({
  args: { prefix, passwords: v.array(v.string()) },
  handler: async (ctx, { prefix, passwords }) => {
    if (passwords.some((p) => p.length < 8)) throw new Error("Passwords need 8+ characters");
    let n = await ctx.runQuery(internal.studyAccounts.nextNumber, { prefix });
    const created: { email: string; name: string; group: string; password: string }[] = [];
    const failed: { email: string; error: string }[] = [];
    for (const password of passwords) {
      const email = accountEmail(prefix, n++);
      try {
        // Hashed here: an action has the time for scrypt, a mutation barely does.
        const passwordHash = await hashPassword(password);
        created.push({ ...(await ctx.runMutation(internal.studyAccounts.createOne, { prefix, email, passwordHash })), password });
      } catch (err) {
        failed.push({ email, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { created, failed };
  },
});

/**
 * Single-use invite codes, one per student, numbered like the accounts and
 * after the group's earlier codes: C01-X7KM9Q, C02-..., for students to sign
 * up with their own email (sign-up form). The group is fixed per code: the
 * code's randomization block (experiment.ensureCondition, keyed by the code
 * the student signed up with) holds just that group. P codes get groups
 * balanced across the batch.
 */
export const createInviteCodes = internalMutation({
  args: { prefix, suffixes: v.array(v.string()) },
  handler: async (ctx, { prefix, suffixes }) => {
    const pattern = new RegExp(`^${prefix}(\\d+)-`);
    let n = 1;
    for (const c of await ctx.db.query("invitationCodes").collect()) {
      const m = pattern.exec(c.code);
      if (m) n = Math.max(n, Number(m[1]) + 1);
    }
    const fixed = GROUPS[prefix].group;
    const groups = fixed ? suffixes.map(() => fixed) : shuffled(balancedGroups({ experimental: 0, control: 0 }, suffixes.length));
    const out: { code: string; group: Group }[] = [];
    for (let i = 0; i < suffixes.length; i++) {
      const code = `${prefix}${String(n++).padStart(2, "0")}-${suffixes[i]}`;
      if (await ctx.db.query("invitationCodes").withIndex("by_code", (q) => q.eq("code", code)).unique()) {
        throw new Error(`Invite code ${code} already exists`);
      }
      await ctx.db.insert("invitationCodes", {
        code, isValid: true, quantity: 1, usesCount: 0, whoUsed: [], createdBy: "scripts/create-study-accounts",
      });
      await ctx.db.insert("randomizationBlocks", { cohort: code, remaining: [groups[i]] });
      out.push({ code, group: groups[i] });
    }
    return out;
  },
});

/** The study accounts so far, with their group (no passwords: those are only in the script's output). */
export const list = internalQuery({
  args: {},
  handler: async (ctx) => {
    const out = [];
    for (const [p, { key }] of Object.entries(GROUPS)) {
      for (const profile of await ctx.db.query("userProfiles").withIndex("by_invitation_code", (q) => q.eq("invitationCode", key)).collect()) {
        const user = await ctx.db.get(profile.userId);
        out.push({ group: p, email: user?.email, condition: user?.experiment_condition ?? null });
      }
    }
    return out;
  },
});
