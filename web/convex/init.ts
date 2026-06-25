import { mutation } from "./_generated/server";
import { createAuth } from "./auth";

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
