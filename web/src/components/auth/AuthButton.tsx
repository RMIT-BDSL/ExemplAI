import * as React from "react";
import { cn } from "#/lib/utils.ts";

export interface AuthButtonProps extends React.ComponentProps<"button"> {
  variant?: "filled" | "outlined" | "tonal" | "text";
  isLoading?: boolean;
  icon?: React.ReactNode;
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
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          "relative inline-flex h-9 select-none items-center justify-center gap-2 rounded-[2px] border px-5 text-xs font-semibold tracking-[0.02em] outline-none transition-opacity disabled:pointer-events-none disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
          {
            // Filled (high emphasis): the one gold action
            "border-brass-fill bg-brass-fill text-on-brass hover:opacity-90":
              variant === "filled",
            // Outlined (medium emphasis)
            "border-rule-strong bg-transparent text-ink hover:bg-surface-raised":
              variant === "outlined",
            // Tonal (secondary background)
            "border-rule bg-surface-raised text-ink hover:bg-surface-hover":
              variant === "tonal",
            // Text (low emphasis)
            "border-transparent bg-transparent px-3 text-brass hover:underline":
              variant === "text",
          },
          className,
        )}
        {...props}
      >
        {isLoading && (
          <svg
            aria-hidden="true"
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
    );
  },
);

AuthButton.displayName = "AuthButton";
