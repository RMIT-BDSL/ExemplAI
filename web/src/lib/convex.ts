import { ConvexReactClient } from "convex/react";

/**
 * Shared Convex client.
 *
 * Lives in its own module so both the router/query context (for prefetching in
 * route loaders) and the React provider tree use the same instance.
 */
export const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL, {
  // Don't fire auth-dependent queries until the better-auth token is loaded.
  expectAuth: true,
});
