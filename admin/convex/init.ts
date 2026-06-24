"use server";

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

    const auth = createAuth(ctx, {
      emailAndPassword: { enabled: true, disableSignUp: false },
    });

    const user = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: "Staff Member",
      },
    });

    return { success: true, userId: user.user.id };
  },
});
