import { mutation } from "./_generated/server";
import { createAuth, authComponent } from "./auth";

export const createAdminUser = mutation({
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

    return { success: true, userId: user.user.id };
  },
});

export const removeAllAdminAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    // Retrieve all users with "admin" role
    const adminUsers = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();

    let deletedCount = 0;
    const auth = createAuth(ctx);
    const adapter = authComponent.adapter(ctx);

    for (const adminUser of adminUsers) {
      // 1. Delete profiles associated with this admin
      const profiles = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", adminUser._id))
        .collect();
      for (const profile of profiles) {
        await ctx.db.delete(profile._id);
      }

      // 2. Delete lesson progress associated with this admin
      const progress = await ctx.db
        .query("lessonProgress")
        .withIndex("by_user", (q) => q.eq("userId", adminUser._id))
        .collect();
      for (const prog of progress) {
        await ctx.db.delete(prog._id);
      }

      // 3. Delete from Better Auth using the official deleteUser API if tokenIdentifier is set
      if (adminUser.tokenIdentifier) {
        // Query sessions for the admin
        const sessions = await adapter.findMany({
          model: "session",
          where: [
            {
              field: "userId",
              value: adminUser.tokenIdentifier,
            },
          ],
        });

        let sessionToken: string;
        if (sessions && sessions.length > 0) {
          sessionToken = sessions[0].token;
        } else {
          sessionToken = "temp-admin-delete-session-" + adminUser._id + "-" + Date.now();
          await adapter.create({
            model: "session",
            data: {
              userId: adminUser.tokenIdentifier,
              token: sessionToken,
              expiresAt: Date.now() + 60 * 1000, // 1 minute
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          });
        }

        const headers = new Headers();
        headers.set("Authorization", `Bearer ${sessionToken}`);

        await auth.api.deleteUser({
          headers,
        });
      }

      // 4. Delete the user from the custom users table
      await ctx.db.delete(adminUser._id);
      deletedCount++;
    }

    return { success: true, count: deletedCount };
  },
});

export const listBetterAuthData = mutation({
  args: {},
  handler: async (ctx) => {
    const adapter = authComponent.adapter(ctx);
    const users = await adapter.findMany({
      model: "user",
    });
    const accounts = await adapter.findMany({
      model: "account",
    });
    const sessions = await adapter.findMany({
      model: "session",
    });
    return { users, accounts, sessions };
  },
});


