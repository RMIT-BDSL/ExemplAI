import { MessageSquare, ChevronRight } from "lucide-react"
import ChatBox, { type PendingMessage } from "./problem/ChatBox"

interface SidePanelProps {
  onCollapse?: () => void
  pendingMessage?: PendingMessage | null
  editorRef?: React.MutableRefObject<any>
  currentCode?: string
  lessonId?: string
}

export default function SidePanel({ onCollapse, pendingMessage, editorRef, currentCode, lessonId }: SidePanelProps) {
  return (
    <div className="flex h-full w-[420px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl text-zinc-100 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
          <MessageSquare className="size-4 text-emerald-400" />
          <span>AI Assistant</span>
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="rounded-md p-1 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
            title="Collapse panel"
          >
            <ChevronRight className="size-4 text-zinc-400" />
          </button>
        )}
      </div>

      {/* Pane Content */}
      <div className="flex-1 min-h-0">
        <ChatBox pendingMessage={pendingMessage} editorRef={editorRef} currentCode={currentCode} lessonId={lessonId} />
      </div>
    </div>
  )
}