import { createServerFn } from "@tanstack/react-start";
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

