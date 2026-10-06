import { Menu } from "lucide-react";
import { useState } from "react";
import ChangelogButton from "#/components/changelog/ChangelogButton";
import GroupToggle from "#/components/student/GroupToggle";
import UserStatusButton from "#/components/nav/UserStatusButton";

interface StatusBarProps {
  week: number | undefined;
  topic: string | undefined;
  isIndexOpen: boolean;
  onOpenIndex: () => void;
}

/**
 * The lesson workspace's only bar (replaces the global navbar on /course):
 * "Week N · Topic" on the left opens the lesson index; the account menu sits
 * on the right and also carries the theme switch and "What's new". During staff
 * testing a study-group toggle sits beside it (GroupToggle).
 */
export default function StatusBar({
  week,
  topic,
  isIndexOpen,
  onOpenIndex,
}: StatusBarProps) {
  const [whatsNewRequest, setWhatsNewRequest] = useState(0);
  const label = [week !== undefined ? `Week ${week}` : null, topic]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className="flex h-9 flex-shrink-0 items-center justify-between border-b border-rule-strong bg-surface-void px-6 select-none">
      <button
        type="button"
        onClick={onOpenIndex}
        aria-haspopup="dialog"
        aria-expanded={isIndexOpen}
        aria-controls="lesson-index"
        title="Lesson index"
        className="-ml-1 flex items-center gap-2 rounded-[2px] px-1 py-0.5 text-[10px] uppercase tracking-[0.15em] text-ink-label hover:text-brass transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
      >
        <Menu className="size-3.5" />
        <span>{label || "Lessons"}</span>
      </button>

      <div className="flex items-center">
        <GroupToggle />
        <UserStatusButton
          variant="workspace"
          onWhatsNew={() => setWhatsNewRequest((n) => n + 1)}
        />
        {/* Dialog only; opened from the account menu (and auto-opens for new notes). */}
        <ChangelogButton trigger="none" openRequest={whatsNewRequest} />
      </div>
    </header>
  );
}
