import { Link, useMatches } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import UserStatusButton from "./UserStatusButton";

/**
 * Top navigation bar for authenticated pages.
 *
 * Single responsibility: app-level layout — branding on the left, the user
 * status control on the right. Delegates all user/session concerns to
 * UserStatusButton.
 */
export default function Navbar() {
  const matches = useMatches();
  const isCoursePage = matches.some((match) => match.routeId === "/_authenticated/course");

  return (
    <header className="sticky top-0 z-45 border-b border-line bg-white/70 dark:bg-black/70 backdrop-blur-xl text-sea-ink">
      <nav className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 dark:max-w-none dark:px-6">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-[14px] font-semibold tracking-tight text-sea-ink hover:text-lagoon transition-colors"
          >
            ExemplAI
          </Link>

          {isCoursePage && (
            <>
              <div className="h-3 w-px bg-line" />
              <Link
                to="/"
                className="flex items-center gap-1 text-[11px] font-medium text-sea-ink-soft hover:text-sea-ink hover:bg-sand transition-all px-2.5 py-1 rounded-md border border-line bg-white/40 dark:bg-transparent"
              >
                <ChevronLeft className="size-3" />
                <span>Syllabus</span>
              </Link>
            </>
          )}
        </div>

        <UserStatusButton />
      </nav>
    </header>
  );
}
