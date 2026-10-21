import { Editor } from "@monaco-editor/react";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { type ReactNode, type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { defineEditorThemes } from "#/lib/editorThemes";

/** A frozen block shown between two lines of the code. */
export interface NotebookBlock {
  id: string;
  /**
   * The line the block sits under when it first appears: 0 = above the code,
   * END = under the last line with code on it. After that it follows its line
   * through edits.
   */
  anchor: number;
  content: ReactNode;
}

export const END = -1;

export interface NotebookHandle {
  /** The line a block sits under now (null if it isn't shown). */
  lineOf: (id: string) => number | null;
  /** Replace the code, editing only the part that differs so blocks elsewhere stay put. */
  replaceCode: (code: string) => void;
}

/** The last line with code on it (1 for an empty file). */
export function lastCodeLine(lines: string[]) {
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim()) return i + 1;
  return 1;
}

interface Entry {
  zone: any;
  zoneId: string;
  widget: any;
  node: HTMLDivElement;
  anchor: any | null;
  observer: ResizeObserver;
}

interface NotebookEditorProps {
  theme: string;
  defaultValue: string;
  onChange: (value: string) => void;
  onMount: (editor: any, monaco: any) => void;
  blocks: NotebookBlock[];
  handleRef: Ref<NotebookHandle>;
}

/**
 * One code document with frozen blocks (outputs, tutor threads) between its
 * lines, like a notebook that is still a single file. Each block is a Monaco
 * view zone (the gap) with an overlay widget on top (the React content); a
 * decoration on its line moves it as the code is edited. The code itself is
 * the editor's text, so Run/Submit see plain Python.
 */
export default function NotebookEditor({
  theme,
  defaultValue,
  onChange,
  onMount,
  blocks,
  handleRef,
}: NotebookEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const entries = useRef(new Map<string, Entry>());
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const [ready, setReady] = useState(false);

  // Each block renders (through a portal) into its own node, created on first sight.
  function nodeFor(id: string) {
    let node = nodes.current.get(id);
    if (!node) {
      node = document.createElement("div");
      node.style.position = "absolute";
      nodes.current.set(id, node);
    }
    return node;
  }

  function place(node: HTMLDivElement) {
    const layout = editorRef.current.getLayoutInfo();
    node.style.left = `${layout.contentLeft}px`;
    node.style.width = `${layout.contentWidth - layout.verticalScrollbarWidth - 16}px`;
  }

  function add(block: NotebookBlock): Entry {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();
    const lines = model.getLinesContent();
    const line =
      block.anchor === END ? lastCodeLine(lines) : Math.max(0, Math.min(block.anchor, lines.length));

    const node = nodeFor(block.id);
    const widget = { getId: () => `notebook.${block.id}`, getDomNode: () => node, getPosition: () => null };
    editor.addOverlayWidget(widget);
    place(node);
    // Wheel over a block scrolls the document, as it would over code.
    node.onwheel = (e) => {
      e.preventDefault();
      editor.setScrollTop(editor.getScrollTop() + e.deltaY);
    };

    const zone = {
      afterLineNumber: line,
      heightInPx: node.offsetHeight,
      domNode: document.createElement("div"),
      suppressMouseDown: true,
      onDomNodeTop: (top: number) => {
        node.style.top = `${top}px`;
      },
    };
    let zoneId = "";
    editor.changeViewZones((acc: any) => {
      zoneId = acc.addZone(zone);
    });

    // Whole line, never growing at its edges: typing at the end of the line or
    // a new line after it leaves the block where it is; splitting the line
    // moves it under the second half.
    const anchor =
      line > 0
        ? editor.createDecorationsCollection([
            {
              range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
              options: { stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges },
            },
          ])
        : null;

    const observer = new ResizeObserver(() => {
      if (zone.heightInPx === node.offsetHeight) return;
      zone.heightInPx = node.offsetHeight;
      editor.changeViewZones((acc: any) => acc.layoutZone(zoneId));
    });
    observer.observe(node);
    return { zone, zoneId, widget, node, anchor, observer };
  }

  function remove(entry: Entry) {
    const editor = editorRef.current;
    entry.observer.disconnect();
    entry.anchor?.clear();
    editor.removeOverlayWidget(entry.widget);
    editor.changeViewZones((acc: any) => acc.removeZone(entry.zoneId));
  }

  // Add blocks that are new and drop ones that are gone. A block keeps its
  // place once shown; only its content re-renders.
  useEffect(() => {
    if (!ready) return;
    const wanted = new Set(blocks.map((b) => b.id));
    for (const [id, entry] of entries.current) {
      if (wanted.has(id)) continue;
      remove(entry);
      entries.current.delete(id);
      nodes.current.delete(id);
    }
    for (const block of blocks) {
      if (!entries.current.has(block.id)) entries.current.set(block.id, add(block));
    }
  });

  useImperativeHandle(handleRef, () => ({
    lineOf: (id) => entries.current.get(id)?.zone.afterLineNumber ?? null,
    replaceCode: (code) => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) return;
      const model = editor.getModel();
      const old: string = model.getValue();
      let start = 0;
      while (start < old.length && start < code.length && old[start] === code[start]) start++;
      let end = 0;
      while (
        end < old.length - start &&
        end < code.length - start &&
        old[old.length - 1 - end] === code[code.length - 1 - end]
      )
        end++;
      const range = monaco.Range.fromPositions(
        model.getPositionAt(start),
        model.getPositionAt(old.length - end),
      );
      editor.pushUndoStop();
      editor.executeEdits("restore", [{ range, text: code.slice(start, code.length - end) }]);
      editor.pushUndoStop();
      editor.focus();
    },
  }));

  function handleMount(editor: any, monaco: any) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Blocks follow their line through edits.
    editor.onDidChangeModelContent(() => {
      const moved: Entry[] = [];
      for (const entry of entries.current.values()) {
        const line = entry.anchor?.getRange(0)?.endLineNumber;
        if (line && line !== entry.zone.afterLineNumber) {
          entry.zone.afterLineNumber = line;
          moved.push(entry);
        }
      }
      if (moved.length) {
        editor.changeViewZones((acc: any) => {
          for (const entry of moved) acc.layoutZone(entry.zoneId);
        });
      }
    });
    editor.onDidLayoutChange(() => {
      for (const entry of entries.current.values()) place(entry.node);
    });
    onMount(editor, monaco);
    setReady(true);
  }

  return (
    <ClientOnly>
      <div className="h-full bg-surface-editor">
        <Editor
          beforeMount={defineEditorThemes}
          onMount={handleMount}
          height="100%"
          language="python"
          defaultValue={defaultValue}
          onChange={(v) => onChange(v ?? "")}
          theme={theme}
          loading={
            <div className="flex h-full w-full items-center justify-center text-ink-label">
              <Loader2 className="size-5 animate-spin text-brass" />
            </div>
          }
          // Same options as the course editor (components/student/CodeEditor).
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            smoothScrolling: true,
            padding: { top: 12, bottom: 12 },
            roundedSelection: true,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            scrollbar: {
              vertical: "auto",
              horizontal: "auto",
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
              useShadows: false,
              verticalHasArrows: false,
              horizontalHasArrows: false,
            },
          }}
        />
        <BlockPortals blocks={blocks} nodeFor={nodeFor} />
      </div>
    </ClientOnly>
  );
}

// Its own component so the portals' nodes are only made in the browser (inside ClientOnly).
function BlockPortals({
  blocks,
  nodeFor,
}: {
  blocks: NotebookBlock[];
  nodeFor: (id: string) => HTMLDivElement;
}) {
  return <>{blocks.map((block) => createPortal(block.content, nodeFor(block.id), block.id))}</>;
}
