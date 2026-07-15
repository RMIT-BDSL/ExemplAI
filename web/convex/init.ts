import { internalMutation } from "./_generated/server";
import { createAuth, authComponent } from "./auth";
import { components } from "./_generated/api";

export const createAdminUser = internalMutation({
  args: {},
  handler: async (ctx) => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        "ADMIN_EMAIL and ADMIN_PASSWORD environment variables are not set in your Convex deployment. " +
        "Please set them via the Convex Dashboard (Settings -> Environment Variables) or by running " +
        "`npx convex env set ADMIN_EMAIL=... ADMIN_PASSWORD=...` in your terminal."
      );
    }

    const auth = createAuth(ctx);

    const user = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: "Staff Member",
      },
    });

    // Retrieve user in Convex and assign the admin role
    const dbUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (dbUser) {
      await ctx.db.patch(dbUser._id, {
        role: "admin",
      });
    }

    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "_id", value: user.user.id }],
        update: { role: "admin" },
      },
    });

    return { success: true, userId: user.user.id };
  },
});

export const removeAllAdminAccounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const email = process.env.ADMIN_EMAIL;

    // 1. Fetch all Better Auth users (up to 100)
    const betterAuthUsersPage = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      paginationOpts: { cursor: null, numItems: 100 },
    });
    const betterAuthUsers = betterAuthUsersPage.page;

    // 2. Fetch all custom users
    const customUsers = await ctx.db.query("users").collect();

    // 3. Collect Better Auth IDs and custom user IDs that should be deleted
    const betterAuthIdsToDelete = new Set<string>();
    for (const u of betterAuthUsers) {
      const isTargetEmail = email && u.email === email;
      const isTargetRole = u.role === "admin";
      const isTargetName = u.name === "Staff Member";
      if (isTargetEmail || isTargetRole || isTargetName) {
        betterAuthIdsToDelete.add(u._id);
      }
    }

    const customUserIdsToDelete = new Set<any>();
    for (const u of customUsers) {
      const isTargetEmail = email && u.email === email;
      const isTargetRole = u.role === "admin";
      const isTargetName = u.name === "Staff Member";
      const matchesBetterAuthId = u.tokenIdentifier && betterAuthIdsToDelete.has(u.tokenIdentifier);
      if (isTargetEmail || isTargetRole || isTargetName || matchesBetterAuthId) {
        customUserIdsToDelete.add(u._id);
        if (u.tokenIdentifier) {
          betterAuthIdsToDelete.add(u.tokenIdentifier);
        }
      }
    }

    // Double check mapping from custom users back to Better Auth IDs
    for (const u of customUsers) {
      if (u.tokenIdentifier && betterAuthIdsToDelete.has(u.tokenIdentifier)) {
        customUserIdsToDelete.add(u._id);
      }
    }

    let deletedCount = 0;

    // 4. Delete sessions, accounts, and users from Better Auth
    for (const betterAuthId of betterAuthIdsToDelete) {
      // Delete sessions
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          where: [{ field: "userId", value: betterAuthId }],
          model: "session",
        },
        paginationOpts: { cursor: null, numItems: 100 },
      });

      // Delete accounts
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          where: [{ field: "userId", value: betterAuthId }],
          model: "account",
        },
        paginationOpts: { cursor: null, numItems: 100 },
      });

      // Delete user
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          where: [{ field: "_id", value: betterAuthId }],
          model: "user",
        },
      });

      deletedCount++;
    }

    // 5. Delete from custom tables (profiles, progress, users)
    for (const customUserId of customUserIdsToDelete) {
      // Delete profiles
      const profiles = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", customUserId))
        .collect();
      for (const profile of profiles) {
        await ctx.db.delete(profile._id);
      }

      // Delete lesson progress
      const progress = await ctx.db
        .query("lessonProgress")
        .withIndex("by_user", (q) => q.eq("userId", customUserId))
        .collect();
      for (const prog of progress) {
        await ctx.db.delete(prog._id);
      }

      // Delete user
      await ctx.db.delete(customUserId);
    }

    // 6. Delete orphan profiles that might match any deleted Better Auth IDs
    for (const betterAuthId of betterAuthIdsToDelete) {
      const profilesByToken = await ctx.db
        .query("userProfiles")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", betterAuthId))
        .collect();
      for (const profile of profilesByToken) {
        await ctx.db.delete(profile._id);
      }
    }

    return { success: true, count: deletedCount };
  },
});

export const listBetterAuthData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const paginationOpts = { cursor: null, numItems: 100 };
    const users = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      paginationOpts,
    });
    const accounts = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "account",
      paginationOpts,
    });
    const sessions = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "session",
      paginationOpts,
    });
    const customUsers = await ctx.db.query("users").collect();
    return { users, accounts, sessions, customUsers };
  },
});

export const clearJwks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const jwksPage = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "jwks",
      paginationOpts: { cursor: null, numItems: 100 },
    });

    let deletedCount = 0;
    for (const row of jwksPage.page) {
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          where: [{ field: "_id", value: row._id }],
          model: "jwks",
        },
      });
      deletedCount++;
    }

    return { success: true, deletedCount };
  },
});


