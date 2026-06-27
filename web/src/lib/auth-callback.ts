/**
 * Pure helpers for the magic-link auth flow.
 *
 * These were previously inlined in the auth components, which duplicated the
 * `?`/`&` query-join in three places and made the tracking logic untestable.
 * Centralising them keeps the marker handling consistent and unit-testable.
 */

/**
 * Append a query parameter to a (possibly already-parameterised) path.
 * Picks `?` or `&` based on whether the path already has a query string.
 */
export function appendQueryParam(
  path: string,
  key: string,
  value: string,
): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

/**
 * Build the callbackURL for a magic-link request.
 *
 * Always tags the URL with `magic=1` so the destination route can recognise a
 * completed magic-link sign-in and emit identify + `user_signed_in`. Optionally
 * carries an invitation `code` for the new-user (sign-up) flow.
 */
export function buildMagicLinkCallback(
  redirectUrl: string | undefined,
  options?: { code?: string },
): string {
  let callback = redirectUrl || "/";
  if (options?.code) {
    callback = appendQueryParam(callback, "code", options.code);
  }
  return appendQueryParam(callback, "magic", "1");
}

/**
 * Remove the given keys from a search-params object, returning a new object.
 * Used to strip one-shot markers (`magic`, `code`) after they've been handled
 * so a page refresh doesn't re-trigger the side effect.
 */
export function stripSearchParams<T extends Record<string, unknown>>(
  search: T,
  keys: string[],
): Partial<T> {
  const rest = { ...search };
  for (const key of keys) {
    delete rest[key];
  }
  return rest;
}
