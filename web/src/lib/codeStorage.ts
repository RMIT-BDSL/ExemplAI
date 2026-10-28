// The tab's copy of each lesson's code (sessionStorage), written by the editor's
// autosave in routes/_authenticated.course.tsx.

const PREFIX = "exemplai_code_";

/** Key for one account's code on one lesson. Keyed by account so a different
 *  sign-in in the same tab (a shared lab computer) never sees it. Copies saved
 *  under the old lesson-only key are deliberately not read: they carry no
 *  owner, so reading them is the bug this fixes. The server draft still has
 *  the student's work unless its last save failed. */
export const codeStorageKey = (userId: string, lessonId: string, language: string) =>
  `${PREFIX}${userId}_${lessonId}_${language}`;

/** Remove every saved copy of lesson code from this tab, on sign-out. Each
 *  account's work is also saved on the server, so nothing is lost. */
export function clearSavedCode() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {}
}
