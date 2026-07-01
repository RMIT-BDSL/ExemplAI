import { createClient, type AuthFunctions } from "@convex-dev/better-auth";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { magicLink, admin } from "better-auth/plugins";
import { components, internal } from "./_generated/api";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { type GenericCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel.d.ts";
import authConfig from "./auth.config";

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        // Sync user to your custom 'users' table
        await ctx.db.insert("users", {
          name: authUser.name || undefined,
          email: authUser.email,
          image: authUser.image || undefined,
          // safeGetAuthUser returns the raw Convex doc, whose id is `_id`
          // (there is no `.id` field) — using `.id` here wrote undefined.
          tokenIdentifier: authUser._id,
        });
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuthOptions = (ctx: GenericCtx<DataModel>): BetterAuthOptions => {
  return {
    database: authComponent.adapter(ctx),
    baseURL: process.env.BETTER_AUTH_URL || 
             process.env.SITE_URL || 
             (process.env.CONVEX_SITE_URL ? `${process.env.CONVEX_SITE_URL}/api/auth` : undefined),
    secret: process.env.BETTER_AUTH_SECRET || "dev-secret-key-at-least-32-chars-long-exemplai",
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
      ...(process.env.VITE_TRUSTED_ORIGINS?.split(",") || []),
    ],
    user: {
      deleteUser: {
        enabled: true
      },
      additionalFields: {
        isAnonymous: { type: "boolean", required: false },
        phone: { type: "string", required: false },
        phoneVerificationTime: { type: "number", required: false },
        emailVerificationTime: { type: "number", required: false },
        tokenIdentifier: { type: "string", required: false },
        role: { type: "string", required: false },
        banned: { type: "boolean", required: false },
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      convex({ authConfig, jwtExpirationSeconds: 60 * 60 * 24 }),
      crossDomain({
        siteUrl: process.env.SITE_URL || "http://localhost:5173",
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          console.log(`\n==================================================`);
          console.log(`[Dev Mailer] Magic Link for: ${email}`);
          console.log(`URL: ${url}`);
          console.log(`==================================================\n`);
        },
      }),
      admin(),
    ],
  };
};

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};

// Query to get currently authenticated user session
export const getSessionUser = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) return null;
    return {
      user: {
        // safeGetAuthUser returns the raw Convex doc; its id is `_id`.
        id: authUser._id,
        email: authUser.email,
        name: authUser.name || undefined,
        image: authUser.image || undefined,
        emailVerified: authUser.emailVerified,
        createdAt: authUser.createdAt,
        updatedAt: authUser.updatedAt,
      },
      session: {
        userId: authUser._id,
      },
    };
  },
});

// Public query to check if user exists in Convex by email
export const checkUserExistsQuery = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    return !!user;
  },
});
