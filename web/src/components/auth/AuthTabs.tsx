import * as React from "react"
import { cn } from "#/lib/utils"

export interface AuthTabsProps {
  activeTab: "signin" | "signup" // | "magiclink"
  onChange: (tab: "signin" | "signup" /* | "magiclink" */) => void
}

export function AuthTabs({ activeTab, onChange }: AuthTabsProps) {
  return (
    <div className="relative flex p-1 bg-zinc-200/60 dark:bg-zinc-800/80 rounded-full w-full border border-zinc-300/40 dark:border-zinc-700/50">
      {/* Animated Sliding Background Indicator */}
      <div
        className={cn(
          "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-zinc-900 rounded-full shadow-md transition-all duration-300 cubic-bezier(0.2, 0, 0, 1)",
          activeTab === "signin"
            ? "left-1"
            : "left-[calc(50%+1px)]"
        )}
      />

      {/* Sign In Button */}
      <button
        type="button"
        onClick={() => onChange("signin")}
        className={cn(
          "relative z-10 w-1/2 text-center text-xs sm:text-sm font-semibold py-2.5 rounded-full select-none transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagoon-deep)]/50",
          activeTab === "signin"
            ? "text-[var(--sea-ink)] dark:text-white"
            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        )}
      >
        Sign In
      </button>

      {/* Magic Link Button
      <button
        type="button"
        onClick={() => onChange("magiclink")}
        className={cn(
          "relative z-10 w-1/3 text-center text-xs sm:text-sm font-semibold py-2.5 rounded-full select-none transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagoon-deep)]/50",
          activeTab === "magiclink"
            ? "text-[var(--sea-ink)] dark:text-white"
            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        )}
      >
        Magic Link
      </button>
      */}

      {/* Sign Up Button */}
      <button
        type="button"
        onClick={() => onChange("signup")}
        className={cn(
          "relative z-10 w-1/2 text-center text-xs sm:text-sm font-semibold py-2.5 rounded-full select-none transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagoon-deep)]/50",
          activeTab === "signup"
            ? "text-[var(--sea-ink)] dark:text-white"
            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        )}
      >
        Sign Up
      </button>
    </div>
  )
}
