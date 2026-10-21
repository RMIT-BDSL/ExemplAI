import { Send, Sparkles } from "lucide-react";
import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "#/lib/utils.ts";
import { EXAMPLE_WAIT_LINES, exampleWaitLine } from "#/lib/waitMessages.ts";
import RunnableCodeBlock from "./RunnableCodeBlock";
import { type ExampleTrigger, useTutorChat } from "./useTutorChat";
// Types for Chat
export interface Message {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** Tutor turns: "new_example" when the reply delivered an example. */
  responseType?: string;
}

// Time only for today's messages; older ones also show the date, since each
// lesson keeps one chat across sessions.
function timeOf(d: Date) {
  const time = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

// Runnable code blocks (#84) are off unless VITE_RUNNABLE_CHAT_CODE=true at
// build time; the server's RUNNABLE_CHAT_CODE should match (Erroneous prompt).
const RUNNABLE_CHAT_CODE = import.meta.env.VITE_RUNNABLE_CHAT_CODE === "true";

// Fences the student can edit and run in place: Python, or untagged (the
// course is Python-only). Others (text, output, …) stay read-only.
const RUNNABLE_LANGUAGES = new Set(["python", "py", "python3"]);

// Read-only code, e.g. a block of expected output.
function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="chat-code chat-code-wrap editorial-scroll my-2 max-h-80 rounded-[4px] border border-rule-strong !bg-surface-page">
      {code}
    </pre>
  );
}

// Module-level so the renderers keep their identity across re-renders;
// otherwise every new message would remount each RunnableCodeBlock and
// wipe the student's edits and output.
const markdownComponents: Components = {
  // Unwrap <pre> so the CodeBlock isn't nested in another <pre>.
  pre(props) {
    return <>{props.children}</>;
  },
  code(props) {
    const { children, className, ...rest } = props;
    const raw = String(children ?? "");
    const lang = /language-(\w+)/.exec(className || "")?.[1];
    // react-markdown v10 dropped the `inline` prop: a fence with a
    // language tag or any multi-line snippet is a block.
    if (lang || raw.includes("\n")) {
      const code = raw.replace(/\n$/, "");
      return RUNNABLE_CHAT_CODE &&
        (!lang || RUNNABLE_LANGUAGES.has(lang.toLowerCase())) ? (
        <RunnableCodeBlock code={code} />
      ) : (
        <CodeBlock code={code} />
      );
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },
};

// 1. One turn. Tutor turns read as marginal prose (serif, no bubble), with a
// generic "Example" label when the reply delivered an example; the kind of
// example (Complete/Faded/Erroneous) is never shown. Student turns are plain
// sans boxes on the right.
export function MessageBubble({ message }: { message: Message }) {
  if (message.sender === "user") {
    return (
      <div className="ml-12 flex flex-col items-end gap-1">
        <div className="whitespace-pre-wrap rounded-[4px] border border-rule bg-surface-raised px-3 py-2.5 font-sans text-xs leading-relaxed text-ink">
          {message.content}
        </div>
        <span className="select-none text-[9px] text-ink-label">
          {timeOf(message.timestamp)}
        </span>
      </div>
    );
  }

  const isExample = message.responseType === "new_example";
  return (
    <div>
      <div className="mb-1.5 select-none font-sans text-[9px] font-semibold uppercase tracking-[0.15em]">
        {isExample && <span className="text-brass">Example · </span>}
        <span className="font-medium text-ink-label">
          {timeOf(message.timestamp)}
        </span>
      </div>
      <div className="prose max-w-none text-ink-chat prose-p:my-1.5 first:prose-p:mt-0 last:prose-p:mb-0 prose-ol:my-1 prose-ul:my-1 prose-li:my-0.5 prose-pre:my-2">
        <ReactMarkdown components={markdownComponents}>
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// Progress while the tutor works, from the server's step events.
const AGENT_NODES = [
  "complete_example_node",
  "faded_example_node",
  "erroneous_example_node",
  "control_agent_node",
];

export function TutorProgress({
  steps,
  forExample = false,
}: {
  steps: string[];
  /** Get help / New example: show the example wait lines (lib/waitMessages). */
  forExample?: boolean;
}) {
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  if (forExample) {
    const current = exampleWaitLine(seconds, steps);
    return (
      <div
        className="space-y-1 py-1 font-sans text-xs text-ink-label"
        role="status"
        aria-label="The tutor is writing an example"
      >
        {EXAMPLE_WAIT_LINES.slice(0, current + 1).map((label, i) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-2",
              i === current && "text-ink",
            )}
          >
            <span className="w-3 text-center">{i < current ? "✓" : "●"}</span>
            <span>
              {label}
              {i === current ? "…" : ""}
            </span>
          </div>
        ))}
        <div className="pl-5 tabular-nums">{seconds}s</div>
      </div>
    );
  }

  const read = steps.includes("input_guardrail");
  const lastDraft = Math.max(...AGENT_NODES.map((n) => steps.lastIndexOf(n)));
  const lastCheck = steps.lastIndexOf("dean_validation_node");
  // While we're still waiting, a finished Dean step means it sent the draft
  // back for one more try (an approval ends the wait).
  const retrying = lastCheck >= 0;
  const rows = [
    { label: "Reading your message", done: read },
    // Done once a draft has been written since the Dean's last check.
    {
      label: retrying ? "Improving the reply" : "Writing a reply",
      done: lastDraft > lastCheck,
    },
    { label: "Checking the reply", done: false },
  ];
  const current = rows.findIndex((r) => !r.done);

  return (
    <div
      className="space-y-1 py-1 font-sans text-xs text-ink-label"
      role="status"
      aria-label="The tutor is working"
    >
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={cn("flex items-center gap-2", i === current && "text-ink")}
        >
          <span className="w-3 text-center">
            {r.done ? "✓" : i === current ? "●" : "○"}
          </span>
          <span>
            {r.label}
            {i === current ? "…" : ""}
          </span>
        </div>
      ))}
      <div className="pl-5 tabular-nums">{seconds}s</div>
    </div>
  );
}

// 2. Message feed
export interface MessageFeedProps {
  messages: Message[];
  isTyping?: boolean;
  /** Graph steps finished so far for the reply being written. */
  progress?: string[];
  /** The reply being written is a new example (Get help / New example). */
  waitingForExample?: boolean;
}

export function MessageFeed({
  messages,
  isTyping,
  progress = [],
  waitingForExample = false,
}: MessageFeedProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when messages or typing change
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div
      className="flex-1 space-y-5 overflow-y-auto px-6 py-6 editorial-scroll"
      aria-live="polite"
    >
      <AccuracyNotice />
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isTyping && (
        <TutorProgress steps={progress} forExample={waitingForExample} />
      )}

      <div ref={bottomRef} />
    </div>
  );
}

/**
 * The AI-accuracy notice the ethics approval requires every time the tutor is
 * opened (wording from the Participant Information and Consent Form).
 */
export function AccuracyNotice() {
  return (
    <details className="border-l-2 border-rule-strong pl-3 font-sans text-[11px] leading-relaxed text-ink-label">
      <summary className="cursor-pointer select-none hover:text-ink">
        The tutor is an AI and can be wrong. Think critically, and check with your instructor if you're unsure.
      </summary>
      <p className="mt-1.5">
        Due to the statistical nature of large language models (LLMs), it may occasionally generate inaccurate,
        misleading, or incomplete information. To avoid this, you are encouraged to think critically and not treat
        the virtual tutor as a replacement for your instructors. If you are uncertain about the tutor's answers, you
        should seek clarification and discuss them with your instructors. This helps ensure accuracy while supporting
        deeper learning and independent problem-solving.
      </p>
    </details>
  );
}

// 3. Chat input
export interface ChatInputProps {
  onSendMessage: (text: string) => void;
  /** The ✦ example button beside the input (Get help / New example), once help has started. */
  example?: {
    label: string;
    enabled: boolean;
    /** Why it's unavailable (tooltip + screen-reader text). */
    hint?: string | null;
    onClick: () => void;
  };
}

// Same 52px bar and 32px control height as the editor footer, so the two line up.
const BAR =
  "flex h-[52px] flex-shrink-0 items-center border-t border-rule-strong bg-surface-void px-6";

export function ChatInput({ onSendMessage, example }: ChatInputProps) {
  const [text, setText] = React.useState("");
  const hintId = React.useId();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = !!text.trim();
  return (
    <form onSubmit={handleSubmit} className={cn(BAR, "gap-2")}>
      <div className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-[2px] border border-rule bg-surface-raised pl-3 pr-1 focus-within:border-brass">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the tutor…"
          aria-label="Message the tutor"
          rows={1}
          className="h-full min-w-0 flex-1 resize-none select-text bg-transparent py-[7px] font-sans text-xs leading-[16px] text-ink outline-none placeholder:text-ink-label"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-[2px] transition-opacity select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
            canSend
              ? "bg-brass-fill text-on-brass hover:opacity-90 cursor-pointer"
              : "bg-surface-hover text-ink-faint cursor-not-allowed",
          )}
        >
          <Send className="size-3" />
        </button>
      </div>
      {example && (
        <>
          <button
            type="button"
            onClick={example.onClick}
            disabled={!example.enabled}
            aria-label={example.label}
            aria-describedby={example.hint ? hintId : undefined}
            title={
              example.enabled ? example.label : (example.hint ?? example.label)
            }
            // Same outline style as the editor's Run button.
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-[2px] border border-rule-strong px-3 text-[11px] font-medium tracking-[0.02em] transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
              example.enabled
                ? "text-brass hover:bg-surface-raised cursor-pointer"
                : "text-ink-faint cursor-not-allowed",
            )}
          >
            <Sparkles className="size-3.5" />
            Example
          </button>
          {example.hint && (
            <span id={hintId} className="sr-only">
              {example.hint}
            </span>
          )}
        </>
      )}
    </form>
  );
}

/** Where the input would be while the chat is locked: says why, and what to do next. */
export function LockedBar({ text }: { text: string }) {
  return (
    <div className={BAR}>
      <p
        className="min-w-0 flex-1 font-sans text-xs leading-4 text-ink-label"
        role="status"
      >
        {text}
      </p>
    </div>
  );
}

/** Before help starts, after a failed Submit: the whole bar is the Get help button. */
export function GetHelpBar({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <div className={BAR}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex h-8 flex-1 items-center justify-center gap-2 rounded-[2px] border border-brass-fill bg-brass-fill text-[11px] font-semibold tracking-[0.02em] text-on-brass transition-opacity select-none hover:opacity-90 disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
      >
        <Sparkles className="size-3.5" />
        Get help
      </button>
    </div>
  );
}


export { GET_HELP_MESSAGE, NEW_EXAMPLE_MESSAGE } from "./useTutorChat";

// 5. Chat Box default exported container. The conversation itself (locking,
// examples, the control group's open chat) lives in useTutorChat.
export default function ChatBox({
  editorRef,
  currentCode,
  lessonId,
  onExampleRequested,
}: {
  editorRef?: React.MutableRefObject<any>;
  currentCode?: string;
  lessonId?: string;
  onExampleRequested?: (trigger: ExampleTrigger, examplesUsed: number) => void;
}) {
  const chat = useTutorChat({
    editorRef,
    currentCode,
    lessonId,
    onExampleRequested,
  });
  const {
    isTyping,
    isControl,
    helpStarted,
    remaining,
    exhausted,
    canGetHelp,
    canNewExample,
    exampleStatus,
    exampleTrigger,
    exampleEnabled,
    ready,
    requestExample,
  } = chat;

  // Before the first turn, a welcome line on what to do next.
  const messages: Message[] = React.useMemo(
    () =>
      chat.messages.some((m) => m.id !== "local-error")
        ? chat.messages
        : [
            {
              id: "welcome",
              sender: "assistant",
              content: isControl
                ? "I'm your tutor. Ask me anything about this lesson."
                : remaining > 0
                  ? "Your solution didn't pass yet. Press **Get help** and I'll show you an example to help you with this problem."
                  : "I'm your tutor. Submit your solution first. If it doesn't pass, you can get help here.",
              timestamp: new Date(),
            },
            ...chat.messages,
          ],
    [chat.messages, isControl, remaining],
  );

  return (
    <div className="flex h-full flex-col bg-transparent">
      {/* Greyed until help starts, so the panel stays visible but quiet. */}
      <div
        className={cn(
          "flex flex-1 min-h-0 flex-col",
          !helpStarted && !isTyping && "opacity-60",
        )}
      >
        <MessageFeed
          messages={messages}
          isTyping={isTyping}
          progress={chat.progress}
          waitingForExample={chat.waitingForExample}
        />
      </div>

      {/* One bar, three states: locked (before a failed Submit) → Get help button →
          chat, with the ✦ Example button beside the input. Same triggers and limits as before. */}
      {/* Each lesson visit opens a fresh chat, but examples count per lesson: if
          Get help was used on an earlier visit, this chat's Get help bar fetches
          the next earned example (new_example) instead. */}
      {!helpStarted && !isTyping && (canGetHelp || canNewExample) ? (
        <GetHelpBar
          onClick={() => requestExample(exampleTrigger)}
          disabled={!exampleEnabled}
        />
      ) : helpStarted && !isTyping && ready ? (
        // The input only exists while the student can actually type; locked or
        // waiting on the tutor, there is no bar. Why the Example button is
        // unavailable is its tooltip.
        <ChatInput
          onSendMessage={(text) => chat.sendMessage(text)}
          example={
            !isControl
              ? {
                  label:
                    exampleTrigger === "get_help" ? "Get help" : "New example",
                  enabled: exampleEnabled && !exhausted,
                  hint: exampleStatus,
                  onClick: () => requestExample(exampleTrigger),
                }
              : undefined
          }
        />
      ) : !helpStarted && !isTyping ? (
        // Locked for any reason other than the tutor replying (no failed Submit
        // yet, or this lesson's examples are used up): say why in the bar.
        <LockedBar
          text={exampleStatus ?? "The chat opens after you press Get help"}
        />
      ) : null}
    </div>
  );
}
