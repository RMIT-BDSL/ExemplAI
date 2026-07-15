import { Link } from "@tanstack/react-router";
import UserStatusButton from "./UserStatusButton";

/**
 * Top navigation bar for authenticated pages.
 *
 * Single responsibility: app-level layout — branding on the left, the user
 * status control on the right. Delegates all user/session concerns to
 * UserStatusButton.
 */
export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/95 backdrop-blur text-sea-ink dark:text-zinc-100">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 dark:max-w-none dark:px-6">
        <Link
          to="/"
          className="text-base font-extrabold tracking-tight text-sea-ink dark:text-zinc-100 hover:text-sea-ink-soft dark:hover:text-emerald-400 transition-colors"
        >
          ExemplAI
        </Link>

        <UserStatusButton />
      </nav>
    </header>
  );
}
