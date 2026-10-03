import { Link } from "@tanstack/react-router";
import { useState } from "react";
import ChangelogButton from "../changelog/ChangelogButton";
import UserStatusButton from "./UserStatusButton";

/**
 * Top bar for authenticated pages (the syllabus). Same look as the lesson
 * workspace's status bar: wordmark on the left, the account menu (theme
 * switch, What's new, sign out) on the right. Not rendered on /course: the
 * workspace has its own status bar (components/student/StatusBar).
 */
export default function Navbar() {
  const [whatsNewRequest, setWhatsNewRequest] = useState(0);
  return (
    <header className="sticky top-0 z-45 border-b border-rule-strong bg-surface-void">
      <nav className="flex h-9 items-center justify-between px-6">
        <Link
          to="/"
          className="rounded-[2px] text-[13px] font-semibold tracking-tight text-ink hover:text-brass transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          ExemplAI
        </Link>
        <div className="flex items-center">
          <UserStatusButton
            variant="workspace"
            onWhatsNew={() => setWhatsNewRequest((n) => n + 1)}
          />
          {/* Dialog only; opened from the account menu (and auto-opens for new notes). */}
          <ChangelogButton trigger="none" openRequest={whatsNewRequest} />
        </div>
      </nav>
    </header>
  );
}
