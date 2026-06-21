import * as React from "react"
import { cn } from "#/lib/utils.ts"

export interface AuthButtonProps extends React.ComponentProps<"button"> {
  variant?: "filled" | "outlined" | "tonal" | "text"
  isLoading?: boolean
  icon?: React.ReactNode
}

export const AuthButton = React.forwardRef<HTMLButtonElement, AuthButtonProps>(
  (
    {
      className,
      children,
      variant = "filled",
      isLoading = false,
      icon,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-wide h-10 px-6 select-none transition-all duration-200 outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
          {
            // Filled Button (high emphasis)
            "bg-[var(--lagoon-deep)] text-white hover:bg-[var(--lagoon-deep)]/90 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[var(--lagoon-deep)] focus-visible:ring-offset-2":
              variant === "filled",

            // Outlined Button (medium emphasis)
            "border border-zinc-300 dark:border-zinc-700 bg-transparent text-[var(--sea-ink)] dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 focus-visible:ring-2 focus-visible:ring-zinc-400":
              variant === "outlined",

            // Tonal Button (medium emphasis, secondary background)
            "bg-[var(--sand)] dark:bg-zinc-800 text-[var(--sea-ink-soft)] dark:text-zinc-200 hover:bg-[var(--sand)]/80 dark:hover:bg-zinc-800/80 focus-visible:ring-2 focus-visible:ring-[var(--lagoon-deep)]":
              variant === "tonal",

            // Text Button (low emphasis)
            "bg-transparent text-[var(--lagoon-deep)] hover:bg-zinc-50 dark:hover:bg-zinc-800/50 px-4 focus-visible:underline":
              variant === "text",
          },
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && icon && <span className="flex-shrink-0">{icon}</span>}
        <span className="truncate">{children}</span>
      </button>
    )
  }
)

AuthButton.displayName = "AuthButton"
