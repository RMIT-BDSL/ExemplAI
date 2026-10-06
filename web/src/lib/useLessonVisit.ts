import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// Keep in step with convex/visits.ts HEARTBEAT_MS.
const HEARTBEAT_MS = 30_000;
const TICK_MS = 5_000;
// Input within this long counts as still working (reading, thinking).
const IDLE_AFTER_MS = 60_000;

/**
 * Time on task: starts a lessonVisits row each time a lesson is opened and
 * reports active time every 30 s. Time counts only while the tab is visible
 * and the student has typed, clicked, scrolled or moved the mouse in the last
 * minute; the server caps every report by real elapsed time.
 */
export function useLessonVisit(lessonId: Id<"questions"> | undefined) {
  const startVisit = useMutation(api.visits.startVisit);
  const heartbeat = useMutation(api.visits.heartbeat);

  useEffect(() => {
    if (!lessonId) return;
    let visitId: Id<"lessonVisits"> | null = null;
    let pending = 0;
    let lastInput = Date.now();
    let cancelled = false;

    const onInput = () => {
      lastInput = Date.now();
    };
    const flush = () => {
      if (!visitId || pending <= 0) return;
      const activeMs = pending;
      pending = 0;
      heartbeat({ visitId, activeMs }).catch(() => {});
    };
    const tick = () => {
      if (document.visibilityState === "visible" && Date.now() - lastInput < IDLE_AFTER_MS) {
        pending += TICK_MS;
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };

    startVisit({ lessonId })
      .then((id) => {
        if (!cancelled) visitId = id;
      })
      .catch(() => {});
    const events = ["keydown", "mousedown", "mousemove", "wheel", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, onInput, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    const ticker = setInterval(tick, TICK_MS);
    const beat = setInterval(flush, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      flush(); // leaving the lesson: report what's left
      clearInterval(ticker);
      clearInterval(beat);
      for (const e of events) window.removeEventListener(e, onInput);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [lessonId, startVisit, heartbeat]);
}
