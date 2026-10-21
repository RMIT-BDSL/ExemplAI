import { ArrowDown, ArrowUp, Code2, Loader2, Pilcrow, Play, Sparkles, Trash2 } from "lucide-react";
import { lazy, type ReactNode, Suspense } from "react";
import { cn } from "#/lib/utils.ts";
import type { CellEditorHandle, CellKeys } from "./MarkdownCellEditor";
import type { Cell, CellType } from "./notebook";

// Each editor loads with the first cell of its kind.
const CodeCellEditor = lazy(() => import("./CodeCellEditor"));
const MarkdownCellEditor = lazy(() => import("./MarkdownCellEditor"));

const TOOL =
  "grid size-6 place-items-center rounded-[2px] text-ink-label transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-brass";

interface NotebookCellProps extends CellKeys {
  cell: Cell;
  /** 1-based, among all cells. */
  index: number;
  count: number;
  focused: boolean;
  autoFocus: boolean;
  theme: string;
  /** Running (code) or waiting on the tutor (markdown). */
  busy: boolean;
  onChange: (source: string) => void;
  onFocus: () => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
  handleRef: (handle: CellEditorHandle | null) => void;
  output: ReactNode;
}

/** One cell: code or markdown, its editor, its tools and its last output. */
export default function NotebookCell({
  cell,
  index,
  count,
  focused,
  autoFocus,
  theme,
  busy,
  onChange,
  onFocus,
  onMove,
  onDelete,
  handleRef,
  output,
  ...keys
}: NotebookCellProps) {
  const isCode = cell.type === "code";
  const setType = (type: CellType) => type !== cell.type && keys.onToggleType();

  return (
    <div
      className={cn(
        "group relative border-l-2 py-1 pr-4",
        focused ? "border-l-brass bg-surface-panel/40" : "border-l-transparent",
      )}
    >
      {/* Tools: shown on hover and on the cell being edited. */}
      <div
        className={cn(
          "absolute top-1 right-4 z-10 flex items-center gap-0.5 rounded-[3px] border border-rule bg-surface-panel p-0.5 shadow-sm transition-opacity",
          focused ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        )}
      >
        <div className="mr-1 flex rounded-[2px] border border-rule">
          {(["code", "markdown"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={cell.type === type}
              onClick={() => setType(type)}
              title={`${type === "code" ? "Code" : "Markdown"} cell (Ctrl/⌘+M switches)`}
              className={cn(
                "flex h-5 items-center gap-1 px-1.5 text-[10px] font-medium cursor-pointer",
                cell.type === type ? "bg-surface-hover text-brass" : "text-ink-label hover:text-ink",
              )}
            >
              {type === "code" ? <Code2 className="size-3" /> : <Pilcrow className="size-3" />}
              {type === "code" ? "Code" : "Markdown"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => keys.onRun(false)}
          disabled={busy}
          aria-label={isCode ? "Run cell" : "Ask the tutor"}
          title={
            isCode
              ? "Run this cell and the code cells above it (Ctrl/⌘+Enter; Shift+Enter runs and moves on)"
              : "Ask the tutor this (Ctrl/⌘+Enter)"
          }
          className={cn(TOOL, "text-brass")}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : isCode ? (
            <Play className="size-3 fill-current" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
        </button>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 1} aria-label="Move cell up" className={TOOL}>
          <ArrowUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === count}
          aria-label="Move cell down"
          className={TOOL}
        >
          <ArrowDown className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={count === 1}
          aria-label="Delete cell"
          className={cn(TOOL, "hover:text-danger")}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="flex items-start">
        <div
          className="w-12 shrink-0 select-none pt-[9px] pr-1 text-right font-mono text-[10px] text-ink-faint"
          aria-hidden="true"
        >
          {isCode ? `[${index}]` : "md"}
        </div>
        <Suspense fallback={<div className="h-[38px] flex-1" />}>
          {isCode ? (
            <CodeCellEditor
              key="code"
              theme={theme}
              initialValue={cell.source}
              autoFocus={autoFocus}
              onChange={onChange}
              onFocus={onFocus}
              handleRef={handleRef}
              {...keys}
            />
          ) : (
            <div className="min-w-0 flex-1 pl-3">
              <MarkdownCellEditor
                key="markdown"
                initialValue={cell.source}
                placeholder="Notes, or a question for the tutor (markdown). Ctrl/⌘+Enter asks."
                autoFocus={autoFocus}
                onChange={onChange}
                onFocus={onFocus}
                handleRef={handleRef}
                {...keys}
              />
            </div>
          )}
        </Suspense>
      </div>
      {output && <div className="mt-1 ml-12 pl-3">{output}</div>}
    </div>
  );
}

/** Between cells: add a code or markdown cell here. */
export function InsertBar({ onInsert }: { onInsert: (type: CellType) => void }) {
  return (
    <div className="group/insert relative flex h-4 items-center pl-14 pr-4">
      <div className="h-px flex-1 bg-transparent transition-colors group-hover/insert:bg-rule" />
      <div className="absolute left-1/2 flex -translate-x-1/2 gap-1 opacity-0 transition-opacity group-hover/insert:opacity-100 focus-within:opacity-100">
        {(["code", "markdown"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onInsert(type)}
            className="flex h-4 items-center gap-1 rounded-[2px] border border-rule bg-surface-panel px-1.5 font-sans text-[9px] font-medium text-ink-label hover:text-brass cursor-pointer focus-visible:outline-2 focus-visible:outline-brass"
          >
            + {type === "code" ? "Code" : "Markdown"}
          </button>
        ))}
      </div>
    </div>
  );
}
