import { createClient, type AuthFunctions } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { magicLink } from "better-auth/plugins";
import { components, internal } from "./_generated/api";
import { type GenericCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel.d.ts";
import authConfig from "./auth.config";

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        // Sync user to custom 'users' table
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

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  overrides?: Partial<Parameters<typeof betterAuth>[0]>
) => {
  return betterAuth({
    database: authComponent.adapter(ctx),
    baseURL:
      process.env.BETTER_AUTH_URL ||
      process.env.SITE_URL ||
      (process.env.CONVEX_SITE_URL
        ? `${process.env.CONVEX_SITE_URL}/api/auth`
        : undefined),
    secret:
      process.env.BETTER_AUTH_SECRET ||
      "dev-secret-key-at-least-32-chars-long-exemplai-admin",
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
      ...(process.env.VITE_TRUSTED_ORIGINS?.split(",") || []),
    ],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      ...overrides?.emailAndPassword,
    },
    plugins: [
      convex({ authConfig, jwtExpirationSeconds: 60 * 60 * 24 }),
      crossDomain({
        siteUrl: process.env.SITE_URL || "http://localhost:3000",
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          console.log(`\n==================================================`);
          console.log(`[Dev Mailer] Admin Magic Link for: ${email}`);
          console.log(`URL: ${url}`);
          console.log(`==================================================\n`);
        },
      }),
    ],
    ...overrides,
  });
};
