import { zCustomMutation, zCustomQuery } from "convex-helpers/server/zod4";
import { NoOp } from "convex-helpers/server/customFunctions";
import { mutation, query } from "./_generated/server";

/**
 * Query/mutation builders that validate their `args` with Zod instead of
 * Convex validators. Use these in place of `query`/`mutation` when you want
 * Zod's richer validation (string length, number ranges, etc.).
 */
export const zQuery = zCustomQuery(query, NoOp);
export const zMutation = zCustomMutation(mutation, NoOp);
