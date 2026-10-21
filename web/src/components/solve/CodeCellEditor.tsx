import { Editor } from "@monaco-editor/react";
import { useRef } from "react";
import { defineEditorThemes } from "#/lib/editorThemes";
import type { CellEditorHandle, CellKeys } from "./MarkdownCellEditor";

interface CodeCellEditorProps extends CellKeys {
  theme: string;
  initialValue: string;
  autoFocus?: boolean;
  onChange: (text: string) => void;
  onFocus: () => void;
  handleRef: (handle: CellEditorHandle | null) => void;
}

/**
 * A code cell's editor: Monaco with the course editor's look, as tall as its
 * code (the page scrolls, not the cell).
 */
export default function CodeCellEditor({
  theme,
  initialValue,
  autoFocus,
  onChange,
  onFocus,
  handleRef,
  ...keys
}: CodeCellEditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  // Latest callbacks, for Monaco's commands made at mount.
  const props = useRef({ onFocus, keys });
  props.current = { onFocus, keys };

  function handleMount(editor: any, monaco: any) {
    const { KeyMod, KeyCode } = monaco;
    // Actions, not addCommand: Monaco's commands are shared by every editor on
    // the page, so with several cells the last one made would get them all.
    const bind = (id: string, label: string, keybinding: number, run: () => void) =>
      editor.addAction({ id: `notebook.${id}`, label, keybindings: [keybinding], run });
    bind("run", "Run cell", KeyMod.CtrlCmd | KeyCode.Enter, () => props.current.keys.onRun(false));
    bind("runNext", "Run cell and go to the next", KeyMod.Shift | KeyCode.Enter, () => props.current.keys.onRun(true));
    bind("toggle", "Switch to markdown", KeyMod.CtrlCmd | KeyCode.KeyM, () => props.current.keys.onToggleType());
    bind("ask", "Ask the tutor about this", KeyMod.CtrlCmd | KeyCode.KeyI, () => props.current.keys.onAsk?.());
    // Arrow up on the first line / down on the last one moves to the next cell,
    // unless a suggestion list is open.
    editor.onKeyDown((e: any) => {
      const up = e.keyCode === KeyCode.UpArrow;
      if (!up && e.keyCode !== KeyCode.DownArrow) return;
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      if (editor.getContribution("editor.contrib.suggestController")?.model?.state) return;
      const selection = editor.getSelection();
      if (!selection?.isEmpty()) return;
      const lines = editor.getModel().getLineCount();
      if (up ? selection.startLineNumber !== 1 : selection.startLineNumber !== lines) return;
      e.preventDefault();
      e.stopPropagation();
      props.current.keys.onLeave(up ? -1 : 1);
    });
    editor.onDidFocusEditorText(() => props.current.onFocus());

    const resize = () => {
      if (host.current) host.current.style.height = `${editor.getContentHeight()}px`;
      editor.layout();
    };
    editor.onDidContentSizeChange(resize);
    resize();

    handleRef({
      focus: (at) => {
        editor.focus();
        const model = editor.getModel();
        const line = at === "start" ? 1 : model.getLineCount();
        editor.setPosition({ lineNumber: line, column: at === "start" ? 1 : model.getLineMaxColumn(line) });
      },
    });
    if (autoFocus) editor.focus();
  }

  return (
    <div ref={host} className="min-w-0 flex-1" style={{ height: 38 }}>
      <Editor
        beforeMount={defineEditorThemes}
        onMount={handleMount}
        language="python"
        defaultValue={initialValue}
        onChange={(v) => onChange(v ?? "")}
        theme={theme}
        loading={null}
        options={{
          // The course editor's look (components/student/CodeEditor), sized to the code.
          minimap: { enabled: false },
          fontSize: 14,
          lineHeight: 22,
          fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          padding: { top: 8, bottom: 8 },
          roundedSelection: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          renderLineHighlightOnlyWhenFocus: true,
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          folding: false,
          glyphMargin: false,
          lineDecorationsWidth: 8,
          lineNumbersMinChars: 3,
          // Suggestions and hovers can spill out of a short cell.
          fixedOverflowWidgets: true,
          scrollbar: {
            vertical: "hidden",
            horizontal: "auto",
            horizontalScrollbarSize: 8,
            useShadows: false,
            alwaysConsumeMouseWheel: false,
          },
        }}
      />
    </div>
  );
}
