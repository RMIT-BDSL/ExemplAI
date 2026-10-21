import { Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AccuracyNotice, type Message, MessageBubble, TutorProgress } from "#/components/student/problem/ChatBox";
import { cn } from "#/lib/utils.ts";

/** One line to ask the tutor: Enter sends, Esc cancels (when it can). */
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const canSend = !!text.trim() && !disabled;
  return (
    <form
      className="flex h-8 items-center gap-1 rounded-[2px] border border-rule bg-surface-raised pl-3 pr-1 focus-within:border-brass"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSend) return;
        onSend(text.trim());
        setText("");
      }}
    >
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && onCancel) {
            e.preventDefault();
            onCancel();
          }
        }}
        disabled={disabled}
        aria-label="Ask the tutor"
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent font-sans text-xs text-ink outline-none placeholder:text-ink-label disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send"
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-[2px]",
          canSend ? "bg-brass-fill text-on-brass hover:opacity-90 cursor-pointer" : "bg-surface-hover text-ink-faint cursor-not-allowed",
        )}
      >
        <Send className="size-3" />
      </button>
    </form>
  );
}

const FRAME = "rounded-[4px] border border-rule-strong border-l-2 border-l-brass/60 bg-surface-panel px-4 py-3";

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
    <div className={cn(FRAME, "space-y-2")}>
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
          placeholder="Your question… (Enter to send, Esc to cancel)"
          onSend={onSend}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

/** Questions and the tutor's replies at one place in the code, frozen once sent. */
export default function ThreadBlock({
  messages,
  notice,
  progress,
  reply,
}: {
  messages: Message[];
  /** The first thread carries the AI-accuracy notice the ethics approval requires. */
  notice: boolean;
  /** Steps of the reply being written, when this thread is waiting for one. */
  progress: string[] | null;
  /** The follow-up box, on the thread that's being talked in. */
  reply: { disabled: boolean; placeholder: string; onSend: (text: string) => void } | null;
}) {
  return (
    <div className={cn(FRAME, "space-y-4")}>
      {notice && <AccuracyNotice />}
      {/* The course chat's prose styles (serif replies, inline code without backticks). */}
      <div className="editorial-chat-container space-y-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>
      {progress && <TutorProgress steps={progress} />}
      {reply && <AskBox disabled={reply.disabled} placeholder={reply.placeholder} onSend={reply.onSend} />}
    </div>
  );
}
