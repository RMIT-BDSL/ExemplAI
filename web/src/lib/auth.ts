import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "dev-secret-key-at-least-32-chars-long-exemplai",
  trustedOrigins: process.env.VITE_TRUSTED_ORIGINS?.split(","),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    tanstackStartCookies(),
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
