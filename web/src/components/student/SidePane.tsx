import ChatBox from "./problem/ChatBox"

interface SidePanelProps {
  onCollapse?: () => void
  editorRef?: React.MutableRefObject<any>
  currentCode?: string
  lessonId?: string
  failedSubmits?: number
  onOpenScratchpad?: (code: string, language?: string) => void
  onGetHelp?: () => void
}

export default function SidePanel({
  onCollapse,
  editorRef,
  currentCode,
  lessonId,
  failedSubmits,
  onOpenScratchpad,
  onGetHelp,
}: SidePanelProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-md shadow-xl text-zinc-100 animate-in fade-in duration-200">
      {/* Pane Content */}
      <div className="flex-1 min-h-0">
        <ChatBox
          editorRef={editorRef}
          currentCode={currentCode}
          lessonId={lessonId}
          failedSubmits={failedSubmits}
          onCollapse={onCollapse}
          onOpenScratchpad={onOpenScratchpad}
          onGetHelp={onGetHelp}
        />
      </div>
    </div>
  )
}
