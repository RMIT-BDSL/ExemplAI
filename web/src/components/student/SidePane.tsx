import * as React from "react"
import { MessageSquare } from "lucide-react"
import ChatBox from "./problem/ChatBox"

export default function SidePanel() {
  return (
    <div className="flex h-full w-[420px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl text-zinc-100 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
          <MessageSquare className="size-4 text-emerald-400" />
          <span>AI Assistant</span>
        </div>
      </div>

      {/* Pane Content */}
      <div className="flex-1 min-h-0">
        <ChatBox />
      </div>
    </div>
  )
}