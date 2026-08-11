import { MessageSquare, ChevronRight } from "lucide-react"
import ChatBox, { type PendingMessage } from "./problem/ChatBox"

interface SidePanelProps {
  onCollapse?: () => void
  pendingMessage?: PendingMessage | null
  editorRef?: React.MutableRefObject<any>
  currentCode?: string
  lessonId?: string
  onOpenScratchpad?: (code: string, language?: string) => void
  onAskAboutOutput?: (code: string, output: string, language?: string) => void
}

export default function SidePanel({
  onCollapse,
  pendingMessage,
  editorRef,
  currentCode,
  lessonId,
  onOpenScratchpad,
  onAskAboutOutput,
}: SidePanelProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-md shadow-xl text-zinc-100 animate-in fade-in duration-200">
      {/* Pane Content */}
      <div className="flex-1 min-h-0">
        <ChatBox
          pendingMessage={pendingMessage}
          editorRef={editorRef}
          currentCode={currentCode}
          lessonId={lessonId}
          onCollapse={onCollapse}
          onOpenScratchpad={onOpenScratchpad}
          onAskAboutOutput={onAskAboutOutput}
        />
      </div>
    </div>
  )
}