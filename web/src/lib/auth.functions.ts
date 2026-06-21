import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "./auth";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  return await auth.api.getSession({ headers });
});

export const checkUserExists = createServerFn({ method: "POST" })
  .validator((email: string) => email)
  .handler(async ({ data: email }) => {
    const context = await auth.$context;
    const result = await context.internalAdapter.findUserByEmail(email);
    return { exists: !!result?.user };
  });

