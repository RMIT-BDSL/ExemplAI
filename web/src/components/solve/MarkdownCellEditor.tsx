import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, LanguageDescription, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { EditorState, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  placeholder as placeholderExt,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

// A markdown cell with Obsidian-style live preview: the text is rendered as
// you write it (headings, bold, code, lists…), and a line's markdown syntax
// only shows while the cursor is on that line (none when the cell is not
// being edited).

// Markers hidden off the cursor's line.
const HIDDEN_MARKS = new Set(["HeaderMark", "EmphasisMark", "CodeMark", "LinkMark", "URL", "QuoteMark"]);

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-md-bullet";
    span.textContent = "•";
    return span;
  }
}

function activeLines(view: EditorView) {
  const lines = new Set<number>();
  if (!view.hasFocus) return lines;
  for (const r of view.state.selection.ranges) {
    const from = view.state.doc.lineAt(r.from).number;
    const to = view.state.doc.lineAt(r.to).number;
    for (let n = from; n <= to; n++) lines.add(n);
  }
  return lines;
}

function livePreview(view: EditorView): DecorationSet {
  const { state } = view;
  const active = activeLines(view);
  const onActive = (from: number, to: number) => {
    const a = state.doc.lineAt(from).number;
    const b = state.doc.lineAt(to).number;
    for (let n = a; n <= b; n++) if (active.has(n)) return true;
    return false;
  };
  const decos: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;
        const heading = /^ATXHeading(\d)$/.exec(name);
        if (heading) {
          decos.push(Decoration.line({ class: `cm-md-h${heading[1]}` }).range(state.doc.lineAt(node.from).from));
        } else if (name === "FencedCode") {
          for (let pos = node.from; pos <= node.to; ) {
            const line = state.doc.lineAt(pos);
            decos.push(Decoration.line({ class: "cm-md-codeblock" }).range(line.from));
            pos = line.to + 1;
          }
          // The fence's own markers stay (dimmed): a code block is still code.
          return false;
        } else if (name === "Blockquote") {
          for (let pos = node.from; pos <= node.to; ) {
            const line = state.doc.lineAt(pos);
            decos.push(Decoration.line({ class: "cm-md-quote" }).range(line.from));
            pos = line.to + 1;
          }
        } else if (name === "InlineCode") {
          decos.push(Decoration.mark({ class: "cm-md-code" }).range(node.from, node.to));
        } else if (name === "ListMark" && !onActive(node.from, node.to)) {
          const text = state.sliceDoc(node.from, node.to);
          if (text === "-" || text === "*" || text === "+") {
            decos.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to));
          }
        } else if (HIDDEN_MARKS.has(name) && !onActive(node.from, node.to)) {
          // A heading's "# " goes with its space.
          let end = node.to;
          if (name === "HeaderMark" && state.sliceDoc(end, end + 1) === " ") end++;
          if (name === "QuoteMark" && state.sliceDoc(end, end + 1) === " ") end++;
          if (end > node.from) decos.push(Decoration.replace({}).range(node.from, end));
        }
      },
    });
  }
  return Decoration.set(decos, true);
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = livePreview(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.focusChanged ||
        syntaxTree(update.state) !== syntaxTree(update.startState)
      ) {
        this.decorations = livePreview(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// The serif the tutor's replies use (styles.css .editorial-chat-container).
const SERIF = "Georgia, Cambria, \"Times New Roman\", Times, serif";

const highlight = HighlightStyle.define([
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--color-brass)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--color-ink-faint)" },
  { tag: tags.processingInstruction, color: "var(--color-ink-faint)" },
  { tag: tags.monospace, fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace" },
  // Python inside fences.
  { tag: tags.keyword, color: "var(--color-brass)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--color-success)" },
  { tag: tags.comment, color: "var(--color-ink-faint)", fontStyle: "italic" },
  { tag: [tags.number, tags.bool], color: "var(--color-danger)" },
]);

const theme = EditorView.theme({
  "&": { fontSize: "14px", color: "var(--color-ink)", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-sans)", lineHeight: "1.6" },
  ".cm-content": { padding: "8px 0", caretColor: "var(--color-brass)" },
  ".cm-line": { padding: "0" },
  ".cm-placeholder": { color: "var(--color-ink-label)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--color-surface-linehl) !important",
  },
  ".cm-md-h1": { fontSize: "1.5em", fontWeight: "600", fontFamily: SERIF },
  ".cm-md-h2": { fontSize: "1.3em", fontWeight: "600", fontFamily: SERIF },
  ".cm-md-h3, .cm-md-h4, .cm-md-h5, .cm-md-h6": { fontSize: "1.1em", fontWeight: "600" },
  ".cm-md-code": {
    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
    fontSize: "0.92em",
    backgroundColor: "var(--color-surface-hover)",
    borderRadius: "2px",
    padding: "0 3px",
  },
  ".cm-md-codeblock": {
    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
    fontSize: "0.92em",
    backgroundColor: "var(--color-surface-editor)",
    padding: "0 8px !important",
  },
  ".cm-md-quote": { borderLeft: "2px solid var(--color-rule-strong)", paddingLeft: "10px !important" },
  ".cm-md-quote, .cm-md-quote *": { color: "var(--color-ink-muted)" },
  ".cm-md-bullet": { color: "var(--color-brass)", padding: "0 2px" },
});

/** What a cell's editor can be asked to do from outside (the notebook). */
export interface CellEditorHandle {
  focus: (at: "start" | "end") => void;
}

/** The notebook keys shared by code and markdown cells. */
export interface CellKeys {
  /** Ctrl/⌘+Enter runs the cell; Shift+Enter runs it and moves to the next one. */
  onRun: (advance: boolean) => void;
  /** Ctrl/⌘+M switches the cell between code and markdown. */
  onToggleType: () => void;
  /** Arrow up on the first line / down on the last line moves to the next cell. */
  onLeave: (direction: -1 | 1) => void;
  /** Ctrl/⌘+I in code asks about it; Esc leaves a markdown cell. */
  onAsk?: () => void;
}

/** A key binding that always handles its key. */
const handled = (fn: (view: EditorView) => void) => (view: EditorView) => {
  fn(view);
  return true;
};

interface MarkdownCellEditorProps extends CellKeys {
  initialValue: string;
  placeholder: string;
  autoFocus?: boolean;
  onChange: (text: string) => void;
  onFocus: () => void;
  handleRef: (handle: CellEditorHandle | null) => void;
}

/** A markdown cell's editor (CodeMirror 6, live preview). */
export default function MarkdownCellEditor({
  initialValue,
  placeholder,
  autoFocus,
  onChange,
  onFocus,
  handleRef,
  ...keys
}: MarkdownCellEditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  // Latest callbacks, so the editor is made once.
  const props = useRef({ onChange, onFocus, keys });
  props.current = { onChange, onFocus, keys };

  // biome-ignore lint/correctness/useExhaustiveDependencies: made once; callbacks are read through the ref
  useEffect(() => {
    if (!host.current) return;
    const atEdge = (v: EditorView, direction: -1 | 1) => {
      const { main } = v.state.selection;
      if (!main.empty) return false;
      const line = v.state.doc.lineAt(main.head).number;
      if (direction === -1 ? line !== 1 : line !== v.state.doc.lines) return false;
      props.current.keys.onLeave(direction);
      return true;
    };
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          history(),
          keymap.of([
            { key: "Mod-Enter", run: handled(() => props.current.keys.onRun(false)) },
            { key: "Shift-Enter", run: handled(() => props.current.keys.onRun(true)) },
            { key: "Mod-m", run: handled(() => props.current.keys.onToggleType()) },
            { key: "ArrowUp", run: (v) => atEdge(v, -1) },
            { key: "ArrowDown", run: (v) => atEdge(v, 1) },
            { key: "Escape", run: handled((v) => v.contentDOM.blur()) },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          markdown({
            codeLanguages: [LanguageDescription.of({ name: "python", alias: ["py", "python3"], support: python() })],
          }),
          syntaxHighlighting(highlight),
          livePreviewPlugin,
          EditorView.lineWrapping,
          placeholderExt(placeholder),
          theme,
          EditorView.contentAttributes.of({ "aria-label": "Markdown cell" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) props.current.onChange(u.state.doc.toString());
            if (u.focusChanged && u.view.hasFocus) props.current.onFocus();
          }),
        ],
      }),
    });
    handleRef({
      focus: (at) => {
        editor.focus();
        editor.dispatch({ selection: { anchor: at === "start" ? 0 : editor.state.doc.length } });
      },
    });
    if (autoFocus) editor.focus();
    return () => {
      handleRef(null);
      editor.destroy();
    };
  }, []);

  return <div ref={host} className="min-w-0 flex-1" />;
}
