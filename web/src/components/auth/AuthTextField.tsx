import { AlertCircle, Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { cn } from "#/lib/utils";

export interface AuthTextFieldProps
  extends Omit<React.ComponentProps<"input">, "placeholder"> {
  label: string;
  error?: string;
  leadingIcon?: React.ReactNode;
}

/** Labelled input in the workspace style: label above, 2px corners, brass focus. */
export const AuthTextField = React.forwardRef<
  HTMLInputElement,
  AuthTextFieldProps
>(
  (
    { className, type = "text", label, error, leadingIcon, id, ...props },
    ref,
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const isPassword = type === "password";
    const inputType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
      <div className="flex w-full flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="text-[11px] font-medium text-ink-muted"
        >
          {label}
        </label>
        <div className="group relative w-full">
          {leadingIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-ink-label transition-colors group-focus-within:text-brass [&_svg]:size-4">
              {leadingIcon}
            </div>
          )}

          <input
            id={inputId}
            type={inputType}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "h-10 w-full rounded-[2px] border bg-surface-raised text-sm text-ink outline-none transition-colors",
              error ? "border-danger" : "border-rule-strong focus:border-brass",
              leadingIcon ? "pl-10" : "pl-3",
              isPassword || error ? "pr-10" : "pr-3",
              className,
            )}
            {...props}
          />

          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
            {isPassword && !error && (
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="grid size-7 place-items-center rounded-[2px] text-ink-label transition-colors hover:text-brass cursor-pointer focus-visible:outline-2 focus-visible:outline-brass"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            )}
            {error && (
              <AlertCircle
                className="mr-1 size-4 text-danger"
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {error && (
          <p id={errorId} className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);

AuthTextField.displayName = "AuthTextField";
