// A lesson's code in the editor, shared by the course workspace and /solve.

// Shown above a lesson's starter code in the editor (on first load and on
// Reset). Display only: grading reads the function name from the lesson's
// starter_code, and a comment doesn't change what the code does.
const STARTER_HINT = "# replace 'pass' with your function code";

export function withStarterHint(starter: string): string {
  if (!/\bpass\b/.test(starter) || starter.startsWith(STARTER_HINT)) return starter;
  return `${STARTER_HINT}\n${starter}`;
}

/** sessionStorage key for a lesson's code in this tab. */
export const codeStorageKey = (lessonId: string, language: string) => `exemplai_code_${lessonId}_${language}`;

/** The tab's copy of a lesson's code and when it was saved (older tabs stored the code alone). */
export function readTabCopy(key: string): { code: string; at: number } | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.code === "string" && typeof parsed?.at === "number") return parsed;
    } catch {}
    return { code: raw, at: 0 };
  } catch {
    return null;
  }
}
