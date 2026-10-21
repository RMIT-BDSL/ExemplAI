import type { EditorView } from "@codemirror/view";
import { ChevronDown, ChevronRight, Loader2, Send } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AccuracyNotice,
  type Message,
  MessageBubble,
  markdownComponents,
  TutorProgress,
} from "#/components/student/problem/ChatBox";
import { cn } from "#/lib/utils.ts";
import { type FoldAll, useFold } from "./fold";

// CodeMirror only loads once a question is being written.
const MarkdownInput = lazy(() => import("./MarkdownInput"));

/**
 * A question to the tutor, written in markdown with live preview (Obsidian
 * style). Ctrl/⌘+Enter sends, Esc cancels (when it can).
 */
export function AskBox({
  placeholder,
  disabled,
  autoFocus,
  onSend,
  onCancel,
}: {
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onSend: (text: string) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState("");
  const viewRef = useRef<EditorView | null>(null);
  const canSend = !!text.trim() && !disabled;

  function sendFromButton() {
    const view = viewRef.current;
    if (!view || !canSend) return;
    onSend(view.state.doc.toString().trim());
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } });
  }

  return (
    <div className="rounded-[2px] border border-rule bg-surface-raised focus-within:border-brass">
      <div className="flex items-end gap-1 pl-3 pr-1">
        <Suspense fallback={<div className="h-[31px] flex-1" />}>
          <MarkdownInput
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            onSend={onSend}
            onCancel={onCancel}
            onTextChange={setText}
            viewRef={viewRef}
          />
        </Suspense>
        <button
          type="button"
          onClick={sendFromButton}
          disabled={!canSend}
          aria-label="Send"
          title="Send (Ctrl+Enter, or ⌘+Enter on Mac)"
          className={cn(
            "mb-[3px] grid size-6 shrink-0 place-items-center rounded-[2px]",
            canSend
              ? "bg-brass-fill text-on-brass hover:opacity-90 cursor-pointer"
              : "bg-surface-hover text-ink-faint cursor-not-allowed",
          )}
        >
          <Send className="size-3" />
        </button>
      </div>
      <p className="select-none border-t border-rule px-3 py-1 font-sans text-[9px] text-ink-faint">
        Markdown · Ctrl/⌘+Enter to send{onCancel ? " · Esc to cancel" : ""}
      </p>
    </div>
  );
}

const FRAME = "rounded-[4px] border border-rule-strong border-l-2 border-l-brass/60 bg-surface-panel";

/** A question being written (or sent) at a line of the code. */
export function DraftThread({
  about,
  sending,
  disabled,
  onSend,
  onCancel,
}: {
  about: string;
  sending: string | null;
  disabled: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className={cn(FRAME, "space-y-2 px-4 py-3")}>
      <div className="font-sans text-[9px] font-semibold uppercase tracking-[0.15em] text-ink-label">
        Ask about {about}
      </div>
      {/* Required by the ethics approval wherever the tutor is opened. */}
      <AccuracyNotice />
      {sending ? (
        <div className="flex items-center gap-2 font-sans text-xs text-ink-label">
          <Loader2 className="size-3.5 animate-spin text-brass" />
          {sending}
        </div>
      ) : (
        <AskBox
          autoFocus
          disabled={disabled}
          placeholder="Your question… (markdown: **bold**, `code`, - lists)"
          onSend={onSend}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

/** A student's turn: their markdown, rendered. */
function StudentTurn({ message }: { message: Message }) {
  return (
    <div className="ml-12 flex flex-col items-end gap-1">
      <div className="prose prose-sm max-w-full rounded-[4px] border border-rule bg-surface-raised px-3 py-2.5 font-sans text-xs leading-relaxed text-ink prose-p:my-1 first:prose-p:mt-0 last:prose-p:mb-0 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2">
        <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
      </div>
    </div>
  );
}

/** The first line of a question, for the folded header. */
function firstLine(text: string) {
  return (
    text
      .split("\n")
      .map((l) => l.replace(/^[#>\s*+-]+/, "").replace(/[*_`]/g, "").trim())
      .find(Boolean) ?? ""
  );
}

/** Questions and the tutor's replies at one place in the code, frozen once sent. */
export default function ThreadBlock({
  messages,
  notice,
  progress,
  reply,
  foldAll,
}: {
  messages: Message[];
  /** The first thread carries the AI-accuracy notice the ethics approval requires. */
  notice: boolean;
  /** Steps of the reply being written, when this thread is waiting for one. */
  progress: { steps: string[]; forExample: boolean } | null;
  /** The follow-up box, on the thread that's being talked in. */
  reply: { disabled: boolean; placeholder: string; onSend: (text: string) => void } | null;
  foldAll: FoldAll;
}) {
  const [open, setOpen] = useFold(true, foldAll);
  const question = messages.find((m) => m.sender === "user");
  const replies = messages.filter((m) => m.sender === "assistant").length;

  return (
    <div className={FRAME}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-7 w-full items-center gap-2 px-2 text-left font-sans text-[10px] select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-brass"
      >
        {open ? <ChevronDown className="size-3 text-ink-label" /> : <ChevronRight className="size-3 text-ink-label" />}
        <span className="font-semibold uppercase tracking-[0.15em] text-brass">Tutor</span>
        <span className="uppercase tracking-[0.15em] text-ink-label">
          {replies} {replies === 1 ? "reply" : "replies"}
        </span>
        {!open && question && (
          <span className="min-w-0 truncate text-[11px] text-ink-muted">{firstLine(question.content)}</span>
        )}
      </button>
      {open && (
        <div className="space-y-4 border-t border-rule px-4 py-3">
          {notice && <AccuracyNotice />}
          {/* The course chat's prose styles (serif replies, inline code without backticks). */}
          <div className="editorial-chat-container space-y-4">
            {messages.map((m) =>
              m.sender === "user" ? <StudentTurn key={m.id} message={m} /> : <MessageBubble key={m.id} message={m} />,
            )}
          </div>
          {progress && <TutorProgress steps={progress.steps} forExample={progress.forExample} />}
          {reply && <AskBox disabled={reply.disabled} placeholder={reply.placeholder} onSend={reply.onSend} />}
        </div>
      )}
    </div>
  );
}
