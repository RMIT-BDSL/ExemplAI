import * as React from "react";

interface ResizeHandleProps {
  /** Accessible name, e.g. "Resize description". */
  label: string;
  /** Called with the pointer's x position while dragging. */
  onDrag: (clientX: number) => void;
  /** Keyboard: move the boundary by `delta` pixels (negative = left). */
  onNudge: (delta: number) => void;
  /** Double-click: back to the default width. */
  onReset: () => void;
}

/**
 * A draggable column boundary. It takes no layout width: an 8px hit area
 * straddles the border between two columns. Wide screens only (≥1100px),
 * where the three columns sit side by side.
 */
export default function ResizeHandle({ label, onDrag, onNudge, onReset }: ResizeHandleProps) {
  const [dragging, setDragging] = React.useState(false);

  const stop = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  return (
    <div className="relative hidden w-0 flex-shrink-0 min-[1100px]:block">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        title={`${label} (double-click to reset)`}
        tabIndex={0}
        className={`absolute inset-y-0 -left-1 z-20 w-2 cursor-col-resize transition-colors hover:bg-brass/30 focus-visible:bg-brass/40 focus-visible:outline-none ${dragging ? "bg-brass/40" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          // Keep the resize cursor and stop text selection while dragging
          // over the editor or the chat.
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
        onPointerMove={(e) => {
          if (dragging) onDrag(e.clientX);
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onDoubleClick={onReset}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            onNudge(e.key === "ArrowLeft" ? -16 : 16);
          }
        }}
      />
    </div>
  );
}
