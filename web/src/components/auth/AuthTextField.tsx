import * as React from "react"
import { Eye, EyeOff, AlertCircle } from "lucide-react"
import { cn } from "#/lib/utils"

export interface AuthTextFieldProps
  extends Omit<React.ComponentProps<"input">, "placeholder"> {
  label: string
  error?: string
  leadingIcon?: React.ReactNode
}

export const AuthTextField = React.forwardRef<HTMLInputElement, AuthTextFieldProps>(
  ({ className, type = "text", label, error, leadingIcon, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const isPassword = type === "password"
    const inputType = isPassword ? (showPassword ? "text" : "password") : type

    const hasLeadingIcon = !!leadingIcon
    const hasTrailingIcon = isPassword || !!error

    return (
      <div className="w-full flex flex-col gap-1.5">
        <div className="relative w-full group">
          {leadingIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-400 group-focus-within:text-[var(--lagoon-deep)] transition-colors">
              {leadingIcon}
            </div>
          )}

          <input
            type={inputType}
            ref={ref}
            placeholder=" "
            className={cn(
              "peer w-full h-[56px] rounded-xl border bg-transparent text-base transition-all duration-200 outline-none",
              // Outlined style
              error
                ? "border-destructive focus:border-destructive text-destructive"
                : "border-zinc-300 dark:border-zinc-700 focus:border-[var(--lagoon-deep)] text-zinc-950 dark:text-white",
              // Padding based on icons
              hasLeadingIcon ? "pl-12" : "pl-4",
              hasTrailingIcon ? "pr-12" : "pr-4",
              className
            )}
            {...props}
          />

          <label
            className={cn(
              "absolute top-[16px] text-base transition-all duration-200 pointer-events-none origin-left px-1.5 select-none",
              "text-zinc-500 dark:text-zinc-400 bg-[var(--background)] dark:bg-[var(--bg-base)]",
              // Left alignment based on leading icon
              hasLeadingIcon ? "left-[44px]" : "left-[10px]",
              // Floating states (when focused or has text)
              "peer-focus:top-[-10px] peer-focus:scale-80",
              "peer-[:not(:placeholder-shown)]:top-[-10px] peer-[:not(:placeholder-shown)]:scale-80",
              error
                ? "peer-focus:text-destructive text-destructive/80"
                : "peer-focus:text-[var(--lagoon-deep)]"
            )}
          >
            {label}
          </label>

          {/* Trailing actions */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isPassword && !error && (
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="p-1 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            )}

            {error && (
              <div className="text-destructive animate-in fade-in zoom-in duration-200">
                <AlertCircle className="size-5" />
              </div>
            )}
          </div>
        </div>

        {/* Support error/helper text */}
        {error && (
          <p className="text-xs text-destructive font-medium px-1 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
            {error}
          </p>
        )}
      </div>
    )
  }
)

AuthTextField.displayName = "AuthTextField"
