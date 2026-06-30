import { createClient, type AuthFunctions } from "@convex-dev/better-auth";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { magicLink, admin } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
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
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const email = ctx.body?.email;
        const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || process.env.VITE_ALLOWED_EMAIL_DOMAIN;
        if (
          allowedDomain &&
          typeof email === "string" &&
          !email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`)
        ) {
          throw new APIError("BAD_REQUEST", {
            message: `Only email addresses from ${allowedDomain} are allowed.`,
          });
        }
      }),
    },
    plugins: [
      convex({ authConfig, jwtExpirationSeconds: 60 * 60 * 24 }),
      crossDomain({
        siteUrl: process.env.SITE_URL || "http://localhost:5173",
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || process.env.VITE_ALLOWED_EMAIL_DOMAIN;
          if (
            allowedDomain &&
            !email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`)
          ) {
            throw new Error(`Only email addresses from ${allowedDomain} are allowed.`);
          }

          const apiKey = process.env.RESEND_API_KEY;
          const fromEmail = process.env.RESEND_FROM_EMAIL || "ExemplAI <noreply@rmit.edu.vn>";

          if (!apiKey) {
            console.log(`\n==================================================`);
            console.log(`[Dev Mailer] (No RESEND_API_KEY) Magic Link for: ${email}`);
            console.log(`URL: ${url}`);
            console.log(`==================================================\n`);
            return;
          }

          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject: "Sign in to ExemplAI",
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
                  <h2 style="color: #18181b; margin-top: 0;">Sign in to ExemplAI</h2>
                  <p style="color: #71717a; font-size: 16px; line-height: 1.5;">Click the button below to sign in to your ExemplAI account. This link will expire in 5 minutes.</p>
                  <div style="margin: 24px 0;">
                    <a href="${url}" style="background-color: #18181b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Sign In</a>
                  </div>
                  <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
                  <p style="color: #a1a1aa; font-size: 12px; line-height: 1.5; margin-bottom: 0;">If you did not request this email, you can safely ignore it. If the button above doesn't work, copy and paste this URL into your browser:<br /><a href="${url}" style="color: #2563eb; word-break: break-all;">${url}</a></p>
                </div>
              `,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            console.error("Failed to send email via Resend:", errText);
            throw new Error(`Failed to send magic link: ${errText}`);
          }
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
