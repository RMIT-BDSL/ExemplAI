import { Bot, RefreshCw, Send, Sparkles, User } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "#/lib/utils.ts";
import { sendChatMessage } from "#/lib/api.ts";
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
}

export function ChatHeader({ onClearChat, isTyping }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-900/40">
      <div className="flex items-center gap-2.5">
        <div className="relative flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <Bot className="size-4" />
          <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 border border-zinc-900 animate-pulse" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">AI Assistant</h2>
          <p className="text-xs text-zinc-500">
            {isTyping ? "Typing..." : "Online • Ready to help"}
          </p>
        </div>
      </div>
      {onClearChat && (
        <button
          onClick={onClearChat}
          className="inline-flex size-8 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
          title="Reset chat"
        >
          <RefreshCw className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// 2. Individual Message Bubble Component
export interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === "user";

  return (
    <div className={cn("flex w-full gap-3 text-sm", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex size-7 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold border",
          isUser
            ? "bg-zinc-800 border-zinc-700 text-zinc-300"
            : "bg-indigo-950 border-indigo-800 text-indigo-400"
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      {/* Content Bubble */}
      <div className="flex flex-col max-w-[80%] gap-1">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 leading-relaxed shadow-sm",
            isUser
              ? "bg-indigo-600 text-white rounded-tr-none font-medium"
              : "bg-zinc-800/80 border border-zinc-800 text-zinc-200 rounded-tl-none prose prose-invert prose-sm max-w-none prose-p:my-1 first:prose-p:mt-0 last:prose-p:mb-0 prose-ol:my-1 prose-ul:my-1 prose-li:my-0.5 prose-pre:my-2"
          )}
        >
          {isUser ? message.content : <ReactMarkdown>{message.content}</ReactMarkdown>}
        </div>
        {/* Timestamp */}
        <span
          className={cn(
            "text-[10px] text-zinc-500 px-1 select-none",
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
}

export function MessageFeed({ messages, isTyping }: MessageFeedProps) {
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
        messages.map((message) => <MessageBubble key={message.id} message={message} />)
      )}

      {isTyping && (
        <div className="flex w-full gap-3 text-sm flex-row">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-indigo-950 border-indigo-800 text-indigo-400">
            <Bot className="size-3.5" />
          </div>
          <div className="flex flex-col gap-1 max-w-[80%]">
            <div className="flex items-center gap-1 bg-zinc-800/80 border border-zinc-800 rounded-2xl rounded-tl-none px-4 py-3 text-zinc-400">
              <span
                className="size-1.5 animate-bounce rounded-full bg-zinc-500"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="size-1.5 animate-bounce rounded-full bg-zinc-500"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="size-1.5 animate-bounce rounded-full bg-zinc-500"
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
    <form onSubmit={handleSubmit} className="border-t border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div className="relative flex items-end gap-2 bg-zinc-950 border border-zinc-800 focus-within:border-zinc-700 rounded-xl px-3.5 py-2 transition-all">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question or request a hint..."
          disabled={disabled}
          rows={1}
          className="flex-1 max-h-24 resize-none bg-transparent py-1 text-sm text-zinc-100 placeholder-zinc-500 outline-none select-text"
        />
        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-lg transition-all select-none shrink-0",
            text.trim() && !disabled
              ? "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95"
              : "bg-zinc-900 border border-zinc-850 text-zinc-600 cursor-not-allowed"
          )}
        >
          <Send className="size-3.5" />
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
}: {
  pendingMessage?: PendingMessage | null;
  editorRef?: React.MutableRefObject<any>;
  currentCode?: string;
  lessonId?: string;
}) {
  const [isTyping, setIsTyping] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

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

      const response = await sendChatMessage(conversationPayload, chatId, 1, editorContext);

      // Find the last AI assistant message content from the response messages
      const aiMessages = response.messages.filter(
        (msg) => msg.type === "ai" || msg.type === "assistant"
      );
      const lastAiMessage = aiMessages[aiMessages.length - 1];
      const replyContent = lastAiMessage
        ? lastAiMessage.content
        : "Sorry, I couldn't get a response.";

      // The AI message will automatically appear in the UI once the backend 
      // pushes it to Convex. We no longer save it from the frontend to avoid
      // duplication and sync issues.
    } catch (error) {
      console.error("Error communicating with chat server:", error);
      setLocalError("Sorry, I encountered an error connecting to the server.");
    } finally {
      setIsTyping(false);
    }
  };

  // Auto-send a message that was pushed in from outside (terminal error,
  // etc.). Guard on the key so re-renders don't re-send the same content.
  const lastPendingKey = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (
      pendingMessage &&
      pendingMessage.content.trim() &&
      pendingMessage.key !== lastPendingKey.current
    ) {
      lastPendingKey.current = pendingMessage.key;
      handleSendMessage(pendingMessage.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage]);

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
    <div className="flex h-full flex-col bg-zinc-900/50">
      <ChatHeader onClearChat={handleClearChat} isTyping={isTyping} />

      <MessageFeed messages={messages} isTyping={isTyping} />

      {/* Quick Actions (only visible when not typing) */}
      {!isTyping && (
        <div className="flex flex-wrap gap-2 px-6 pb-2">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p.query)}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-all select-none"
            >
              <Sparkles className="size-3 text-indigo-400" />
              {p.label}
            </button>
          ))}
        </div>
      )}

      <ChatInput onSendMessage={handleSendMessage} disabled={isTyping || !chatId} />
    </div>
  );
}
