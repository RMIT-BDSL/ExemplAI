import { Bot, RefreshCw, Send, Sparkles, User } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "#/lib/utils.ts";

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
    <div
      className={cn(
        "flex w-full gap-3 text-sm",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex size-7 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold border",
          isUser
            ? "bg-zinc-800 border-zinc-700 text-zinc-300"
            : "bg-indigo-950 border-indigo-800 text-indigo-400",
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
              : "bg-zinc-800/80 border border-zinc-800 text-zinc-200 rounded-tl-none prose prose-invert prose-sm max-w-none prose-p:my-1 first:prose-p:mt-0 last:prose-p:mb-0 prose-ol:my-1 prose-ul:my-1 prose-li:my-0.5 prose-pre:my-2",
          )}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>
        {/* Timestamp */}
        <span
          className={cn(
            "text-[10px] text-zinc-500 px-1 select-none",
            isUser ? "text-right" : "text-left",
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
            <p className="text-sm font-semibold text-zinc-300">
              Start a conversation
            </p>
            <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
              Ask questions about the problem description, request code hints,
              or understand complexity.
            </p>
          </div>
        </div>
      ) : (
        messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))
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
    <form
      onSubmit={handleSubmit}
      className="border-t border-zinc-800 bg-zinc-900/40 p-4 space-y-3"
    >
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
              : "bg-zinc-900 border border-zinc-850 text-zinc-600 cursor-not-allowed",
          )}
        >
          <Send className="size-3.5" />
        </button>
      </div>
    </form>
  );
}

// 5. Chat Box default exported container
export default function ChatBox() {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      content:
        "Hi there! I am your AI learning assistant. I can help you understand the 'Two Sum' problem, offer hints, or explain algorithms without giving away the direct solution. What would you like to discuss?",
      timestamp: new Date(),
    },
  ]);
  const [isTyping, setIsTyping] = React.useState(false);

  const handleSendMessage = (text: string) => {
    // 1. Add User Message
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // 2. Simulate AI response
    setTimeout(() => {
      let reply =
        "I'm here to help! Could you explain your current approach, or would you like a hint about a brute force solution vs. using a hash map?";

      const lower = text.toLowerCase();
      if (lower.includes("hint") || lower.includes("clue")) {
        reply =
          "Here's a hint: Think about how you can check if the complement (`target - nums[i]`) exists in the array as you iterate. Can we store seen numbers to find it in O(1) time?";
      } else if (lower.includes("complexity") || lower.includes("o(n)")) {
        reply =
          "A brute force solution takes O(N²) time. However, using a Hash Map lets you search for the complement in O(1) average time, bringing the overall complexity down to O(N) time and O(N) space.";
      } else if (
        lower.includes("code") ||
        lower.includes("solution") ||
        lower.includes("answer")
      ) {
        reply =
          "I can't write the final code for you, but I can guide you! Try creating a map that stores key-value pairs of `{ number: index }`. While iterating, check if `target - current_number` is already in the map.";
      }

      const assistantMsg: Message = {
        id: Math.random().toString(),
        sender: "assistant",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome-reset",
        sender: "assistant",
        content: "Chat reset. How can I help you with this problem?",
        timestamp: new Date(),
      },
    ]);
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

      <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
    </div>
  );
}
