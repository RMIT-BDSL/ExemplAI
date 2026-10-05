import { useMutation, useQuery } from "convex/react";
import { Send, Sparkles } from "lucide-react";
import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { streamChatMessage } from "#/lib/api.ts";
import { cn } from "#/lib/utils.ts";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import RunnableCodeBlock from "./RunnableCodeBlock";
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
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

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
      return !lang || RUNNABLE_LANGUAGES.has(lang.toLowerCase()) ? (
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

function TutorProgress({ steps }: { steps: string[] }) {
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

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
}

export function MessageFeed({
  messages,
  isTyping,
  progress = [],
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
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isTyping && <TutorProgress steps={progress} />}

      <div ref={bottomRef} />
    </div>
  );
}

// 3. Chat input
export interface ChatInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
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

export function ChatInput({
  onSendMessage,
  disabled,
  placeholder,
  example,
}: ChatInputProps) {
  const [text, setText] = React.useState("");
  const hintId = React.useId();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSendMessage(text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = !!text.trim() && !disabled;
  return (
    <form onSubmit={handleSubmit} className={cn(BAR, "gap-2")}>
      <div className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-[2px] border border-rule bg-surface-raised pl-3 pr-1 focus-within:border-brass">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Ask the tutor…"}
          aria-label="Message the tutor"
          disabled={disabled}
          rows={1}
          className="h-full min-w-0 flex-1 resize-none select-text bg-transparent py-[7px] font-sans text-xs leading-[16px] text-ink outline-none placeholder:text-ink-label disabled:cursor-not-allowed"
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

// The student turn the Get help button adds to the conversation.
export const GET_HELP_MESSAGE =
  "Please provide me an example to help me with this";
// The student turn the New example button adds.
export const NEW_EXAMPLE_MESSAGE = "Please show me a different example";

type ExampleTrigger = "get_help" | "new_example";

// 5. Chat Box default exported container
// The chat is locked until the student has a failed Submit on the lesson; then
// "Get help" asks the tutor for a first example, after which the student can
// type. Further examples come from "New example", each earned by another failed
// Submit, up to the lesson cap (convex/examples.ts). Convex (addMessage) and
// the server enforce the same rules.
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
  // Graph steps finished for the reply being written (from /chat/stream).
  const [progress, setProgress] = React.useState<string[]>([]);
  const [isTyping, setIsTyping] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  // When the POST /chat connection dies (e.g. Firefox NS_BINDING_ERROR, a reset
  // tunnel, or a malformed response) the assistant reply is usually still
  // persisted to Convex by the backend and arrives through `dbMessages` a moment
  // later. While `awaitingReply` is set we hold the typing indicator and wait
  // for that reply instead of showing a hard error right away.
  const [awaitingReply, setAwaitingReply] = React.useState(false);
  const assistantCountRef = React.useRef(0);
  const replyBaselineRef = React.useRef(0);
  // Stays true from a failed send until its reply lands (or the next send).
  // Outlives `awaitingReply` so a reply that arrives *after* we've shown the
  // timeout error still retracts that error.
  const expectingReplyRef = React.useRef(false);

  // Convex integration
  const convexLessonId = lessonId as Id<"questions"> | undefined;

  // A fresh chat each time the lesson is opened: the student only ever sees
  // this chat; earlier ones stay in Convex for research.
  const [chatId, setChatId] = React.useState<string | null>(null);
  const startChat = useMutation(api.chats.startChat);
  const addMessageMutation = useMutation(api.chats.addMessage);

  // Messages of the current chat only (reactive).
  const dbMessages = useQuery(
    api.chats.getChatMessages,
    chatId ? { chatId: chatId as Id<"chats"> } : "skip",
  );
  // Example allowance: per lesson (carries over when the lesson is reopened);
  // "help started" is per chat, so a fresh chat starts locked.
  const allowance = useQuery(
    api.examples.getExampleAllowance,
    convexLessonId
      ? {
          lessonId: convexLessonId,
          ...(chatId ? { chatId: chatId as Id<"chats"> } : {}),
        }
      : "skip",
  );
  const used = allowance?.used ?? 0;
  const remaining = allowance?.remaining ?? 0;
  const exhausted = allowance?.exhausted ?? false;

  // Map Convex messages to the local Message format
  const messages: Message[] = React.useMemo(() => {
    let result: Message[] = [];
    if (!dbMessages || dbMessages.length === 0) {
      result = [
        {
          id: "welcome",
          sender: "assistant",
          content:
            remaining > 0
              ? "Your solution didn't pass yet. Press **Get help** and I'll show you an example to help you with this problem."
              : "I'm your tutor. Submit your solution first. If it doesn't pass, you can get help here.",
          timestamp: new Date(),
        },
      ];
    } else {
      result = dbMessages.map((msg) => ({
        id: msg._id,
        sender: msg.sender as "user" | "assistant",
        content: msg.content,
        timestamp: new Date(msg._creationTime),
        responseType: msg.response_type,
      }));
    }

    if (localError) {
      result.push({
        id: "local-error",
        sender: "assistant",
        content: localError,
        timestamp: new Date(),
      });
    }
    return result;
  }, [dbMessages, localError, remaining]);

  // Track how many assistant messages Convex currently holds so a failed POST
  // /chat can tell whether the reply landed anyway.
  const assistantCount = React.useMemo(
    () => (dbMessages ?? []).filter((m) => m.sender === "assistant").length,
    [dbMessages],
  );
  React.useEffect(() => {
    assistantCountRef.current = assistantCount;
  }, [assistantCount]);

  // Help starts with the tutor's first reply (to Get help); typing unlocks then.
  const helpStarted = assistantCount > 0;
  // Get help gives a round's first example; New example the rest.
  const canGetHelp = used === 0 && remaining > 0;
  const canNewExample = used > 0 && remaining > 0;
  // One plain line about what to do next; counts and limits stay out of view.
  const exampleStatus = exhausted
    ? "You've used this lesson's examples. Try a lesson on another topic, then come back for more."
    : used === 0 && !canGetHelp
      ? "Help unlocks after a Submit that doesn't pass."
      : used > 0 && !canNewExample
        ? "Try another submit to unlock the next example."
        : null;
  // A reply landed in Convex for a send whose HTTP call failed — clear the
  // waiting state (and any timeout error we may have already shown). Runs
  // whenever the message list grows, regardless of `awaitingReply`.
  React.useEffect(() => {
    if (!expectingReplyRef.current) return;
    if (assistantCount > replyBaselineRef.current) {
      expectingReplyRef.current = false;
      setAwaitingReply(false);
      setIsTyping(false);
      setLocalError(null);
    }
  }, [assistantCount]);

  // The connection failed and no reply has shown up after a generous grace
  // period — tentatively surface the error. This timer only starts *after* the
  // browser request has already died, so it never interrupts an in-flight run;
  // and a late reply still clears it via the effect above.
  React.useEffect(() => {
    if (!awaitingReply) return;
    const timer = setTimeout(() => {
      setAwaitingReply(false);
      setIsTyping(false);
      setLocalError(
        "The connection dropped before a reply came back. If nothing appears shortly, please send your message again.",
      );
    }, 30000);
    return () => clearTimeout(timer);
  }, [awaitingReply]);

  React.useEffect(() => {
    setChatId(null);
    let isActive = true;

    async function initChat() {
      if (convexLessonId) {
        try {
          const id = await startChat({ lessonId: convexLessonId });
          if (isActive) {
            setChatId(id);
          }
        } catch (e) {
          if (isActive) {
            console.error("Failed to initialize chat:", e);
          }
        }
      }
    }
    initChat();

    return () => {
      isActive = false;
    };
  }, [convexLessonId, startChat]);

  const handleSendMessage = async (text: string, trigger?: ExampleTrigger) => {
    if (!chatId || !convexLessonId) return;

    // Optmistically show typing state
    setIsTyping(true);
    setLocalError(null);
    expectingReplyRef.current = false;

    try {
      // 1. Add User Message to Convex
      await addMessageMutation({
        chatId: chatId as Id<"chats">,
        sender: "user",
        content: text,
        ...(trigger ? { trigger } : {}),
      });

      // Prepare conversation payload for backend
      // Note: We use the existing messages array from the UI + the new message
      const conversationPayload = [
        ...messages.filter((m) => m.id !== "welcome"),
        { sender: "user" as const, content: text },
      ];

      // Extract Monaco editor state
      let editorContext = "";
      let code = currentCode || "";
      let cursorLine = null;
      let cursorColumn = null;
      let selectedText = "";

      if (editorRef?.current) {
        const editor = editorRef.current;
        const editorValue = editor.getValue();
        if (editorValue) {
          code = editorValue;
        }

        const selection = editor.getSelection();
        const position = editor.getPosition();

        if (selection && !selection.isEmpty()) {
          selectedText = editor.getModel()?.getValueInRange(selection) || "";
        }

        if (position) {
          cursorLine = position.lineNumber;
          cursorColumn = position.column;
        }
      }

      if (code) {
        editorContext = `Code:\n${code}\n`;
        if (cursorLine !== null && cursorColumn !== null) {
          editorContext += `Cursor Line: ${cursorLine}, Column: ${cursorColumn}\n`;
        }
        if (selectedText) {
          editorContext += `Selected Text:\n${selectedText}\n`;
        }
      }

      // The response body is intentionally unused: the backend persists the
      // assistant reply to Convex and it renders from the reactive `dbMessages`
      // query. This POST just triggers the run.
      setProgress([]);
      await streamChatMessage(
        conversationPayload,
        chatId,
        1,
        editorContext,
        trigger ?? "message",
        (node) => setProgress((prev) => [...prev, node]),
      );
      setIsTyping(false);
    } catch (error) {
      console.error("Error communicating with chat server:", error);
      // The connection to POST /chat failed, but the graph may have still run
      // and saved the reply to Convex. Wait for it to arrive before showing a
      // hard error (see the `awaitingReply` effects above).
      replyBaselineRef.current = assistantCountRef.current;
      expectingReplyRef.current = true;
      setAwaitingReply(true);
    }
  };

  const requestExample = (trigger: ExampleTrigger) => {
    const allowed = trigger === "get_help" ? canGetHelp : canNewExample;
    if (!allowed || isTyping) return;
    onExampleRequested?.(trigger, used);
    // In a fresh chat the button reads Get help even when it fetches the
    // lesson's next example, so the student's turn says so too.
    handleSendMessage(
      trigger === "get_help" || !helpStarted
        ? GET_HELP_MESSAGE
        : NEW_EXAMPLE_MESSAGE,
      trigger,
    );
  };

  const exampleTrigger: ExampleTrigger =
    used === 0 ? "get_help" : "new_example";
  const exampleEnabled =
    (exampleTrigger === "get_help" ? canGetHelp : canNewExample) &&
    !!chatId &&
    !!convexLessonId;

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
          progress={progress}
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
      ) : (
        <ChatInput
          onSendMessage={(text) => handleSendMessage(text)}
          disabled={!helpStarted || isTyping || !chatId || !convexLessonId}
          placeholder={
            isTyping
              ? "The tutor is replying…"
              : !helpStarted
                ? (exampleStatus ?? "The chat opens after you press Get help")
                : // Once help starts the bar always reads as a chat; why the
                  // Example button is unavailable is its tooltip.
                  undefined
          }
          example={
            helpStarted && !isTyping
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
      )}
    </div>
  );
}
