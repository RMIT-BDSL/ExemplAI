import ChatBox from "./problem/ChatBox";

interface SidePanelProps {
  editorRef?: React.MutableRefObject<any>;
  currentCode?: string;
  lessonId?: string;
  onExampleRequested?: (
    trigger: "get_help" | "new_example",
    examplesUsed: number,
  ) => void;
}

/** Tutor panel body (lazy-loaded chunk); the panel frame lives in the course route. */
export default function SidePanel({
  editorRef,
  currentCode,
  lessonId,
  onExampleRequested,
}: SidePanelProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden text-ink">
      <ChatBox
        editorRef={editorRef}
        currentCode={currentCode}
        lessonId={lessonId}
        onExampleRequested={onExampleRequested}
      />
    </div>
  );
}
