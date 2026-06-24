import { createClient, type AuthFunctions } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { magicLink } from "better-auth/plugins";
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
          tokenIdentifier: authUser.id,
        });
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    database: authComponent.adapter(ctx),
    baseURL: process.env.BETTER_AUTH_URL || 
             process.env.SITE_URL || 
             (process.env.CONVEX_SITE_URL ? `${process.env.CONVEX_SITE_URL}/api/auth` : undefined),
    secret: process.env.BETTER_AUTH_SECRET || "dev-secret-key-at-least-32-chars-long-exemplai",
    trustedOrigins: process.env.VITE_TRUSTED_ORIGINS?.split(","),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      convex({ authConfig, jwtExpirationSeconds: 60 * 60 * 24 }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          console.log(`\n==================================================`);
          console.log(`[Dev Mailer] Magic Link for: ${email}`);
          console.log(`URL: ${url}`);
          console.log(`==================================================\n`);
        },
      }),
    ],
  });
};

// Query to get currently authenticated user session
export const getSessionUser = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) return null;
    return {
      user: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name || undefined,
        image: authUser.image || undefined,
        emailVerified: authUser.emailVerified,
        createdAt: authUser.createdAt,
        updatedAt: authUser.updatedAt,
      },
      session: {
        userId: authUser.id,
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
