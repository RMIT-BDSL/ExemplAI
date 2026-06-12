import * as React from "react"
import { useState } from "react"
import { BookOpen, MessageSquare } from "lucide-react"
import { cn } from "#/lib/utils.ts"
import Problem from "./problem/Problem"
import ChatBox from "./problem/ChatBox"

export default function SidePanel() {
  const [activeTab, setActiveTab] = useState<"problem" | "chat">("problem")

  return (
    <div className="flex h-full w-[420px] ml-3 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl text-zinc-100 animate-in fade-in duration-200">
      {/* Top Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900 p-0.5 border border-zinc-850">
          <button
            onClick={() => setActiveTab("problem")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold select-none transition-all cursor-pointer border",
              activeTab === "problem"
                ? "bg-zinc-800 text-zinc-100 shadow-xs border-zinc-700/50"
                : "text-zinc-400 border-transparent hover:text-zinc-200"
            )}
          >
            <BookOpen className="size-3.5" />
            Description
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold select-none transition-all cursor-pointer border",
              activeTab === "chat"
                ? "bg-zinc-800 text-zinc-100 shadow-xs border-zinc-700/50"
                : "text-zinc-400 border-transparent hover:text-zinc-200"
            )}
          >
            <MessageSquare className="size-3.5" />
            AI Assistant
          </button>
        </div>
      </div>

      {/* Pane Content */}
      <div className="flex-1 min-h-0">
        {activeTab === "problem" ? <Problem /> : <ChatBox />}
      </div>
    </div>
  )
}