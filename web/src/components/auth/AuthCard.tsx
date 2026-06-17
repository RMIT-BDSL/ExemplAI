import * as React from "react"
import { Sparkles } from "lucide-react"
import { cn } from "#/lib/utils.ts"

export interface AuthCardProps {
  children: React.ReactNode
  title: string
  subtitle: string
}

export function AuthCard({ children, title, subtitle }: AuthCardProps) {
  return (
    <div className="w-full max-w-[460px] mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out">
      <div className="relative overflow-hidden rounded-[28px] border border-zinc-200/60 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/75 backdrop-blur-xl shadow-2xl p-8 md:p-10">
        {/* Subtle Decorative Glows */}
        <div className="absolute -top-12 -right-12 size-40 bg-[var(--lagoon)]/10 dark:bg-[var(--lagoon)]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 size-40 bg-[var(--palm)]/10 dark:bg-[var(--palm)]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Logo & Header */}
        <div className="flex flex-col items-center text-center mb-8 relative z-10">
          <div className="flex items-center justify-center size-12 rounded-2xl bg-gradient-to-tr from-[var(--lagoon-deep)] to-[var(--lagoon)] text-white shadow-lg shadow-[var(--lagoon-deep)]/20 mb-4 animate-bounce duration-1000">
            <Sparkles className="size-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--sea-ink)] dark:text-white display-title mb-2">
            {title}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-[320px]">
            {subtitle}
          </p>
        </div>

        {/* Children content (Tabs, Forms) */}
        <div className="relative z-10 flex flex-col gap-6">
          {children}
        </div>
      </div>
    </div>
  )
}
