import { useConvexConnectionState } from "convex/react";
import { useEffect, useState } from "react";

/**
 * Says so when the connection drops (campus Wi-Fi), so a student doesn't
 * reload or give up: what they do is saved and syncs when it's back. Shown
 * after a short grace period, so brief blips don't flash it.
 */
export function ConnectionNotice() {
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  const offline = hasEverConnected && !isWebSocketConnected;
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!offline) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, [offline]);
  if (!show) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-[60] mx-auto w-fit max-w-[calc(100%-2rem)] rounded-[4px] border border-danger bg-surface-panel px-4 py-2 text-xs text-ink shadow-lg"
    >
      Connection lost. Reconnecting… Keep working: your answers and code are
      kept and will save when the connection is back.
    </div>
  );
}
