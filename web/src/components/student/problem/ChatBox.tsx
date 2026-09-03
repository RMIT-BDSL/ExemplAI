import { Bot, RefreshCw, Send, Sparkles, User, ChevronRight, MessageSquare, Play, Square, Loader2 } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "#/lib/utils.ts";
import { sendChatMessage, scratchpadExecute } from "#/lib/api.ts";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
// Types for Chat
export interface Message {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// 1. Chat Header Component
export interface ChatHeaderProps {
  onClearChat?: () => void;
  isTyping?: boolean;
  onCollapse?: () => void;
}

export function ChatHeader({ onClearChat, isTyping, onCollapse }: ChatHeaderProps) {
  return (
    <div className="flex h-11 items-center justify-between border-b border-zinc-850 bg-zinc-950/80 px-4 flex-shrink-0">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-250">
        <div className="relative flex items-center justify-center">
          <MessageSquare className="size-3.5 text-lagoon" />
          <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-palm border border-zinc-950 animate-pulse" />
        </div>
        <span>AI Assistant</span>
        {isTyping && (
          <span className="ml-1 text-[10px] font-normal text-zinc-500 animate-pulse">typing...</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {onClearChat && (
          <button
            onClick={onClearChat}
            className="rounded-md p-1 hover:bg-zinc-850 hover:text-zinc-100 transition-colors cursor-pointer"
            title="Reset chat"
          >
            <RefreshCw className="size-3.5 text-zinc-400" />
          </button>
        )}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="rounded-md p-1 hover:bg-zinc-850 hover:text-zinc-100 transition-colors cursor-pointer"
            title="Collapse panel"
          >
            <ChevronRight className="size-4 text-zinc-400" />
          </button>
        )}
      </div>
    </div>
  );
}

// 2. Individual Message Bubble Component
export interface MessageBubbleProps {
  message: Message;
  onOpenScratchpad?: (code: string, language?: string) => void;
  onAskAboutOutput?: (code: string, output: string, language?: string) => void;
}

// Normalise a markdown fence language tag to a monaco/language key.
function normalizeCodeLanguage(lang?: string): string {
  if (!lang) return "python";
  const key = lang.toLowerCase();
  if (key === "python3" || key === "py") return "python";
  if (key === "js" || key === "node") return "javascript";
  if (key === "ts") return "typescript";
  if (key === "c++" || key === "cc" || key === "cpp") return "cpp";
  if (key === "golang") return "go";
  return key;
}

function CodeBlock({
  language,
  code,
  onOpenScratchpad,
  onAskAboutOutput,
}: {
  language?: string;
  code: string;
  onOpenScratchpad?: (code: string, language?: string) => void;
  onAskAboutOutput?: (code: string, output: string, language?: string) => void;
}) {
  const [isRunning, setIsRunning] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);

  const lang = normalizeCodeLanguage(language);

  const LANGUAGE_IDS: Record<string, number> = {
    python: 71,
    javascript: 63,
    typescript: 74,
    java: 62,
    cpp: 54,
    go: 60,
    rust: 73,
  };

  async function handleRun() {
    if (isRunning) return;
    setIsRunning(true);
    setResult(null);
    try {
      const output = await scratchpadExecute(code, LANGUAGE_IDS[lang] ?? 71, "");
      setResult(output);
    } catch (err: any) {
      setResult({
        error: true,
        stderr: err?.response?.data?.detail || err?.message || "Execution failed",
      });
    } finally {
      setIsRunning(false);
    }
  }

  const statusId = result?.status?.id ?? result?.status_id;
  const isAccepted = statusId === 3;
  const outputText = result?.stdout?.trim() || "(empty output)";
  const hasError = Boolean(result?.stderr || result?.compile_output || result?.error);

  return (
    <div className="my-1.5 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      {/* Code header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/70 px-3 py-1">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">
          {language || "code"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenScratchpad?.(code, language)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Open in scratchpad"
          >
            <Square className="size-3" />
            <span>Scratchpad</span>
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="inline-flex items-center gap-1 rounded-md bg-lagoon px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-lagoon-deep disabled:opacity-50 transition-colors cursor-pointer"
            title="Run this snippet"
          >
            {isRunning ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3 fill-current" />
            )}
            <span>Run</span>
          </button>
        </div>
      </div>

      {/* Code body */}
      <pre className="chat-code editorial-scroll max-h-80">{code}</pre>

      {/* Output */}
      {isRunning && (
        <div className="flex items-center gap-2 border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-400 font-mono">
          <Loader2 className="size-3 animate-spin text-lagoon" />
          Executing...
        </div>
      )}
      {!isRunning && result && (
        <div className="border-t border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">
              Output
            </span>
            <span
              className={`rounded-full border px-1.5 py-px text-[9px] font-medium ${
                isAccepted
                  ? "text-palm border-palm/15 bg-palm/10"
                  : "text-red-500 border-red-500/15 bg-red-500/10"
              }`}
            >
              {isAccepted ? "Ran successfully" : result?.status?.description || "Error"}
            </span>
          </div>
          <pre className="chat-code chat-code-wrap editorial-scroll max-h-32">
            {result.stdout ? result.stdout : hasError ? result.stderr || result.compile_output : "(empty output)"}
          </pre>
          {onAskAboutOutput && (
            <div className="px-3 pb-2">
              <button
                type="button"
                onClick={() =>
                  onAskAboutOutput(code, hasError ? result.stderr || result.compile_output || "" : outputText, language)
                }
                className="inline-flex items-center gap-1 rounded-md border border-lagoon/20 bg-lagoon/10 px-2 py-0.5 text-[10px] font-semibold text-lagoon hover:bg-lagoon/20 transition-colors cursor-pointer"
              >
                <Sparkles className="size-3" />
                <span>Ask AI about this result</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ message, onOpenScratchpad, onAskAboutOutput }: MessageBubbleProps) {
  const isUser = message.sender === "user";

  return (
    <div className={cn("flex w-full gap-2.5 text-xs", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex size-6.5 shrink-0 select-none items-center justify-center rounded-full text-[10px] font-semibold border",
          isUser
            ? "bg-zinc-850 border-zinc-750 text-zinc-300"
            : "bg-lagoon/15 border-lagoon/20 text-lagoon"
        )}
      >
        {isUser ? <User className="size-3" /> : <Bot className="size-3" />}
      </div>

      {/* Content Bubble */}
      <div className="flex flex-col max-w-[82%] gap-1">
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 leading-relaxed shadow-sm text-xs",
            isUser
              ? "bg-lagoon text-white rounded-tr-none font-normal"
              : "bg-zinc-800 border border-zinc-750 text-zinc-200 rounded-tl-none prose prose-invert prose-xs max-w-none prose-p:my-0.5 first:prose-p:mt-0 last:prose-p:mb-0 prose-ol:my-0.5 prose-ul:my-0.5 prose-li:my-0.5 prose-pre:my-1.5"
          )}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              components={{
                // Unwrap <pre> so our CodeBlock's <div> isn't nested in it.
                pre(props) {
                  return <>{props.children}</>;
                },
                code(props) {
                  const { children, className, ...rest } = props;
                  const match = /language-(\w+)/.exec(className || "");
                  const raw = String(children ?? "");
                  // react-markdown v10 dropped the `inline` prop, so treat a
                  // fence with a language tag OR any multi-line snippet as a
                  // block; everything else renders as inline code.
                  const isBlock = Boolean(match) || raw.includes("\n");
                  if (isBlock) {
                    return (
                      <CodeBlock
                        language={match?.[1]}
                        code={raw.replace(/\n$/, "")}
                        onOpenScratchpad={onOpenScratchpad}
                        onAskAboutOutput={onAskAboutOutput}
                      />
                    );
                  }
                  return (
                    <code
                      className={cn(
                        "rounded border border-zinc-750 bg-zinc-950/60 px-1 py-px font-mono text-[0.85em] text-zinc-100",
                        className
                      )}
                      {...rest}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {/* Timestamp */}
        <span
          className={cn(
            "text-[9px] text-zinc-550 px-1 select-none",
            isUser ? "text-right" : "text-left"
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

// 3. Message Feed Component
export interface MessageFeedProps {
  messages: Message[];
  isTyping?: boolean;
  onOpenScratchpad?: (code: string, language?: string) => void;
  onAskAboutOutput?: (code: string, output: string, language?: string) => void;
}

export function MessageFeed({ messages, isTyping, onOpenScratchpad, onAskAboutOutput }: MessageFeedProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center space-y-3 px-4 py-8">
          <div className="flex size-12 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-500">
            <Sparkles className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-300">Start a conversation</p>
            <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
              Ask questions about the problem description, request code hints, or understand
              complexity.
            </p>
          </div>
        </div>
      ) : (
        messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onOpenScratchpad={onOpenScratchpad}
            onAskAboutOutput={onAskAboutOutput}
          />
        ))
      )}

      {isTyping && (
        <div className="flex w-full gap-2.5 text-xs flex-row">
          <div className="flex size-6.5 shrink-0 items-center justify-center rounded-full border bg-lagoon/15 border-lagoon/20 text-lagoon">
            <Bot className="size-3" />
          </div>
          <div className="flex flex-col gap-1 max-w-[82%]">
            <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-750 rounded-2xl rounded-tl-none px-3.5 py-2 text-zinc-400">
              <span
                className="size-1.5 animate-bounce rounded-full bg-zinc-550"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="size-1.5 animate-bounce rounded-full bg-zinc-550"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="size-1.5 animate-bounce rounded-full bg-zinc-550"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

// 4. Chat Input Component
export interface ChatInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [text, setText] = React.useState("");

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

  return (
    <form onSubmit={handleSubmit} className="border-t border-zinc-850 bg-zinc-900/20 p-3 space-y-2">
      <div className="relative flex items-end gap-2 bg-zinc-950 border border-zinc-800 focus-within:border-zinc-700 rounded-xl px-3.5 py-1.5 transition-all">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question or request a hint..."
          disabled={disabled}
          rows={1}
          className="flex-1 max-h-24 resize-none bg-transparent py-1 text-xs text-zinc-100 placeholder-zinc-650 outline-none select-text leading-relaxed"
        />
        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-lg transition-all select-none shrink-0 cursor-pointer",
            text.trim() && !disabled
              ? "bg-lagoon text-white hover:bg-lagoon-deep active:scale-95"
              : "bg-zinc-900 border border-zinc-850 text-zinc-650 cursor-not-allowed"
          )}
        >
          <Send className="size-3" />
        </button>
      </div>
    </form>
  );
}

// A message pushed into the chat from outside (e.g. the "Ask AI about this
// error" button in the terminal). The `key` changes each time so the same
// content can be re-sent, and we only auto-send keys we haven't seen yet.
export interface PendingMessage {
  key: number;
  content: string;
}

// 5. Chat Box default exported container
export default function ChatBox({
  pendingMessage,
  editorRef,
  currentCode,
  lessonId,
  onCollapse,
  onOpenScratchpad,
  onAskAboutOutput,
}: {
  pendingMessage?: PendingMessage | null;
  editorRef?: React.MutableRefObject<any>;
  currentCode?: string;
  lessonId?: string;
  onCollapse?: () => void;
  onOpenScratchpad?: (code: string, language?: string) => void;
  onAskAboutOutput?: (code: string, output: string, language?: string) => void;
}) {
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
  
  // Get or create chat session
  const [chatId, setChatId] = React.useState<string | null>(null);
  const getOrCreateChat = useMutation(api.chats.getOrCreateChat);
  const addMessageMutation = useMutation(api.chats.addMessage);
  const clearChatMutation = useMutation(api.chats.clearChat);

  // Fetch messages from Convex
  const dbMessages = useQuery(
    api.chats.getMessages,
    convexLessonId ? { lessonId: convexLessonId } : "skip"
  );

  // Map Convex messages to the local Message format
  const messages: Message[] = React.useMemo(() => {
    let result: Message[] = [];
    if (!dbMessages || dbMessages.length === 0) {
      result = [
        {
          id: "welcome",
          sender: "assistant",
          content: "Hi there I am your AI learning assistant. I can help you understand this problem, offer hints, or explain algorithms without giving away the direct solution. What would you like to discuss?",
          timestamp: new Date(),
        },
      ];
    } else {
      result = dbMessages.map((msg) => ({
        id: msg._id,
        sender: msg.sender as "user" | "assistant",
        content: msg.content,
        timestamp: new Date(msg._creationTime),
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
  }, [dbMessages, localError]);

  // Track how many assistant messages Convex currently holds so a failed POST
  // /chat can tell whether the reply landed anyway.
  const assistantCount = React.useMemo(
    () => (dbMessages ?? []).filter((m) => m.sender === "assistant").length,
    [dbMessages]
  );
  React.useEffect(() => {
    assistantCountRef.current = assistantCount;
  }, [assistantCount]);

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
        "The connection dropped before a reply came back. If nothing appears shortly, please send your message again."
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
          const id = await getOrCreateChat({ lessonId: convexLessonId });
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
  }, [convexLessonId, getOrCreateChat]);

  const handleSendMessage = async (text: string) => {
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
      });

      // Prepare conversation payload for backend
      // Note: We use the existing messages array from the UI + the new message
      const conversationPayload = [
        ...messages.filter(m => m.id !== "welcome"),
        { sender: "user" as const, content: text }
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
      await sendChatMessage(conversationPayload, chatId, 1, editorContext);
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

  // Auto-send a message that was pushed in from outside (terminal error,
  // etc.). Guard on the key so re-renders don't re-send the same content.
  const lastPendingKey = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (
      pendingMessage &&
      pendingMessage.content.trim() &&
      pendingMessage.key !== lastPendingKey.current &&
      chatId &&
      convexLessonId
    ) {
      lastPendingKey.current = pendingMessage.key;
      handleSendMessage(pendingMessage.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage, chatId, convexLessonId]);

  const handleClearChat = async () => {
    if (convexLessonId) {
      await clearChatMutation({ lessonId: convexLessonId });
      // Start a fresh checkpoint thread so the server doesn't resume the old
      // conversation's memory after the student clears the chat.
      const newChatId = await getOrCreateChat({ lessonId: convexLessonId });
      setChatId(newChatId);
    }
  };

  // Quick prompt triggers
  const quickPrompts = [
    { label: "Give a hint", query: "Can you give me a hint on Two Sum?" },
    {
      label: "Explain complexity",
      query: "What is the optimal time complexity?",
    },
    { label: "Stuck on approach", query: "I'm stuck, how should I start?" },
  ];

  return (
    <div className="flex h-full flex-col bg-transparent">
      <ChatHeader onClearChat={handleClearChat} isTyping={isTyping} onCollapse={onCollapse} />

      <MessageFeed messages={messages} isTyping={isTyping} onOpenScratchpad={onOpenScratchpad} onAskAboutOutput={onAskAboutOutput} />

      {/* Quick Actions (only visible when not typing) */}
      {!isTyping && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p.query)}
              disabled={!chatId || !convexLessonId}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-all select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Sparkles className="size-3 text-lagoon" />
              {p.label}
            </button>
          ))}
        </div>
      )}

      <ChatInput onSendMessage={handleSendMessage} disabled={isTyping || !chatId || !convexLessonId} />
    </div>
  );
}
