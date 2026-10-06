/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as chats from "../chats.js";
import type * as courses from "../courses.js";
import type * as examples from "../examples.js";
import type * as experiment from "../experiment.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as invitationCodes from "../invitationCodes.js";
import type * as lessons from "../lessons.js";
import type * as releaseNotes from "../releaseNotes.js";
import type * as seed from "../seed.js";
import type * as studentMetrics from "../studentMetrics.js";
import type * as students from "../students.js";
import type * as triggers from "../triggers.js";
import type * as validators from "../validators.js";
import type * as visits from "../visits.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  chats: typeof chats;
  courses: typeof courses;
  examples: typeof examples;
  experiment: typeof experiment;
  functions: typeof functions;
  http: typeof http;
  init: typeof init;
  invitationCodes: typeof invitationCodes;
  lessons: typeof lessons;
  releaseNotes: typeof releaseNotes;
  seed: typeof seed;
  studentMetrics: typeof studentMetrics;
  students: typeof students;
  triggers: typeof triggers;
  validators: typeof validators;
  visits: typeof visits;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
