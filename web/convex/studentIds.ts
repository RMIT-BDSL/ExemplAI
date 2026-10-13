// Student-ID sign-in and cohort assignment rules, shared by the sign-in page
// and the Convex functions (convex/cohorts.ts).
//
// Students sign in with their university ID only (decided 2026-10-11): no
// email or one-time code, and any well-formed ID gets in. Each ID maps to its
// own Better Auth email+password account, so the same ID always reaches the
// same account on any device. The password is NOT a secret: anyone who knows
// an ID can enter that account. IDs are cross-checked against the cohort
// rosters afterwards (cohortParticipants.on_roster). A cohort can also have a
// session passcode the whole class enters with their ID (checked at sign-in,
// convex/auth.ts), which keeps out anyone outside the class.

export type Group = "experimental" | "control";

/** The domain of the placeholder emails behind ID sign-in (never mailed). */
export const ID_EMAIL_DOMAIN = "id.exemplai.local";

/** "s3912345 " -> "S3912345" */
export function normalizeStudentId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidStudentId(id: string): boolean {
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(id);
}

export function idEmail(id: string): string {
  return `${normalizeStudentId(id).toLowerCase()}@${ID_EMAIL_DOMAIN}`;
}

/** Not a secret (see above); Better Auth needs a password of 8+ characters. */
export function idPassword(id: string): string {
  return `exemplai-id:${normalizeStudentId(id)}`;
}

export function isIdEmail(email: string | undefined | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${ID_EMAIL_DOMAIN}`);
}

/** The student ID behind an ID-sign-in email, or null for other accounts. */
export function studentIdFromEmail(email: string | undefined | null): string | null {
  return isIdEmail(email) ? normalizeStudentId(email!.split("@")[0]) : null;
}

/** The week students see in a session, unless the cohort sets another (decided 2026-10-12). */
export const DEFAULT_SESSION_WEEK = 4;
/**
 * The cap on the exercises, in minutes. The clock starts only when the
 * student finishes the pre quick check, and the post check and post-survey
 * come after it, so every student gets the same exercise time. A 55-minute
 * session after the introduction (decided 2026-10-12): consent 2, pre-survey
 * 3, quick check 5, exercises 35, quick check 5, post-survey 4, 1 to spare.
 */
export const DEFAULT_EXERCISE_MINUTES = 35;
/** Minutes for each quick check (two problems, tutor off). */
export const DEFAULT_CHECK_MINUTES = 5;
/** Bump when the consent text changes (web/src/components/session/consent.ts). */
export const CONSENT_VERSION = "2026-10-12-draft2";

/** A cohort's session passcode matches what the student typed (case and spaces ignored). */
export function passcodeMatches(required: string | undefined, given: string | undefined): boolean {
  const norm = (s: string | undefined) => (s ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return !norm(required) || norm(required) === norm(given);
}

/**
 * Groups for `n` new participants that keep the cohort balanced: each goes to
 * the group with fewer members so far (ties at random). Call with the new IDs
 * in random order so who lands where is random too.
 */
export function balancedGroups(
  counts: Record<Group, number>,
  n: number,
  random: () => number = Math.random,
): Group[] {
  const c = { ...counts };
  const out: Group[] = [];
  for (let i = 0; i < n; i++) {
    const g: Group =
      c.experimental < c.control ? "experimental"
      : c.control < c.experimental ? "control"
      : random() < 0.5 ? "experimental" : "control";
    c[g]++;
    out.push(g);
  }
  return out;
}

export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
