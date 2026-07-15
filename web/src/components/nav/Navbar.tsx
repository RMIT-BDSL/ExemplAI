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
    <header className="sticky top-0 z-40 border-b border-line dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/95 backdrop-blur text-sea-ink dark:text-zinc-100">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 dark:max-w-none dark:px-6">
        <div className="flex items-center gap-3.5">
          <Link
            to="/"
            className="text-base font-extrabold tracking-tight text-sea-ink dark:text-zinc-100 hover:text-sea-ink-soft dark:hover:text-emerald-400 transition-colors"
          >
            ExemplAI
          </Link>

          {isCoursePage && (
            <>
              <div className="h-4 w-px bg-line dark:bg-zinc-800" />
              <Link
                to="/"
                className="flex items-center gap-1 text-xs font-semibold text-sea-ink-soft dark:text-zinc-400 hover:text-sea-ink dark:hover:text-emerald-400 transition-colors bg-sand/35 dark:bg-zinc-900/40 px-2.5 py-1.5 rounded-lg border border-line dark:border-zinc-800"
              >
                <ChevronLeft className="size-3.5" />
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
