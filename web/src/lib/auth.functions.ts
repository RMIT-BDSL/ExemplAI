import { createServerFn } from "@tanstack/react-start";
// import { getPostHogClient } from "#/utils/posthog-server";
import { fetchAuthQuery } from "./auth-server";
import { api } from "../../convex/_generated/api";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  return await fetchAuthQuery(api.auth.getSessionUser, {});
});

export const checkUserExists = createServerFn({ method: "POST" })
  .validator((email: string) => email)
  .handler(async ({ data: email }) => {
    const exists = await fetchAuthQuery(api.auth.checkUserExistsQuery, { email });

    console.log("is user exists in Convex: ", exists);
    return { exists };
  });

export const validateInvitationCode = createServerFn({ method: "POST" })
  .validator((code: string) => code)
  .handler(async ({ data: code }) => {
    return await fetchAuthQuery(api.invitationCodes.validateCode, { code });
  });

/**
 * Server-side capture of a completed sign-in.
 *
 * The browser client (`usePostHog`) also captures sign-in events, but for the
 * magic-link flow the "completion" only happens after the user follows the link
 * in their email and lands back on the app. Mirroring the event server-side via
 * `posthog-node` guarantees it is recorded even if the client disconnects before
 * its own event flushes, and lets us attribute it to the authenticated user id.
 */
/*
export const captureSignIn = createServerFn({ method: "POST" })
  .validator(
    (data: { distinctId: string; method: string; email?: string }) => data,
  )
  .handler(async ({ data }) => {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: data.distinctId,
      event: "user_signed_in",
      properties: { method: data.method, email: data.email },
    });
    // flushAt:1 / flushInterval:0 means this resolves once the event is sent.
    await posthog.flush();
    return { ok: true };
  });
*/

