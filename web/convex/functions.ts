import { zCustomMutation, zCustomQuery } from "convex-helpers/server/zod4";
import { customMutation, customQuery, NoOp } from "convex-helpers/server/customFunctions";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

/**
 * Base query helper that requires user authentication.
 * Resolves the authenticated user via `authComponent.safeGetAuthUser`.
 * Also validates that the user has a profile record (in `userProfiles`), 
 * except for admin users.
 */
export const authenticatedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthenticated");
    }

    // Admins bypass the student profile requirement
    if (user.role !== "admin") {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", user._id))
        .unique();
      if (!profile) {
        throw new Error("Unauthorized: Student profile required. Please redeem an invitation code.");
      }
    }

    return { ctx: { ...ctx, user }, args: {} };
  },
});

/**
 * Base mutation helper that requires user authentication.
 * Resolves the authenticated user via `authComponent.safeGetAuthUser`.
 * Also validates that the user has a profile record (in `userProfiles`),
 * except for admin users.
 */
export const authenticatedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      throw new Error("Unauthenticated");
    }

    // Admins bypass the student profile requirement
    if (user.role !== "admin") {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", user._id))
        .unique();
      if (!profile) {
        throw new Error("Unauthorized: Student profile required. Please redeem an invitation code.");
      }
    }

    return { ctx: { ...ctx, user }, args: {} };
  },
});

/**
 * Admin-only query helper.
 * Requires user authentication and the role "admin".
 */
export const adminQuery = customQuery(authenticatedQuery, {
  args: {},
  input: async (ctx) => {
    if (ctx.user.role !== "admin") {
      throw new Error("Unauthorized: Admin privilege required");
    }
    return { ctx, args: {} };
  },
});

/**
 * Admin-only mutation helper.
 * Requires user authentication and the role "admin".
 */
export const adminMutation = customMutation(authenticatedMutation, {
  args: {},
  input: async (ctx) => {
    if (ctx.user.role !== "admin") {
      throw new Error("Unauthorized: Admin privilege required");
    }
    return { ctx, args: {} };
  },
});

/**
 * Query/mutation builders that validate their `args` with Zod instead of
 * Convex validators. Use these in place of `query`/`mutation` when you want
 * Zod's richer validation (string length, number ranges, etc.).
 */
export const zQuery = zCustomQuery(query, NoOp);
export const zMutation = zCustomMutation(mutation, NoOp);

export const zAuthenticatedQuery = zCustomQuery(authenticatedQuery, NoOp);
export const zAuthenticatedMutation = zCustomMutation(authenticatedMutation, NoOp);

export const zAdminQuery = zCustomQuery(adminQuery, NoOp);
export const zAdminMutation = zCustomMutation(adminMutation, NoOp);
