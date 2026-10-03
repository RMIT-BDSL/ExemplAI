import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Megaphone, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { DropdownMenu } from "radix-ui";
import { authClient } from "#/lib/auth-client";
import { cn } from "#/lib/utils.ts";

/**
 * User status control for the navigation bar.
 *
 * Single responsibility: surface the signed-in user's identity (avatar, name,
 * email) and the sign-out action. Holds no navigation or branding concern.
 */
interface UserStatusButtonProps {
  /** "nav" = landing/syllabus navbar styling; "workspace" = lesson status bar (design tokens). */
  variant?: "nav" | "workspace";
  /** When set, the menu shows a "What's new" item (the workspace has no megaphone button). */
  onWhatsNew?: () => void;
}

export default function UserStatusButton({ variant = "nav", onWhatsNew }: UserStatusButtonProps) {
  const ws = variant === "workspace";
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (isPending) {
    return (
      <div
        className={
          ws
            ? "h-[26px] w-24 rounded-full border border-rule-strong"
            : "size-9 rounded-full bg-sand/60 border border-line"
        }
      />
    );
  }

  const user = session?.user;
  if (!user) return null;

  const initial = user.name?.charAt(0).toUpperCase() || "U";
  const itemClass = cn(
    "flex items-center gap-2 px-2 py-1.5 text-xs font-medium outline-none cursor-pointer transition-colors",
    ws
      ? "rounded-[2px] text-ink data-[highlighted]:bg-surface-hover"
      : "rounded-lg text-sea-ink data-[highlighted]:bg-sand dark:data-[highlighted]:bg-white/10",
  );
  const iconClass = cn("size-3.5", ws ? "text-ink-label" : "text-sea-ink-soft");

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Account menu for ${user.name || "your account"}`}
        className={cn(
          ws
            ? "flex h-[26px] items-center gap-2 rounded-full border border-rule-strong pl-[3px] pr-2 text-ink outline-none hover:border-brass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass cursor-pointer transition-colors"
            : cn(
                "flex items-center gap-2 rounded-full border border-line bg-white/70 dark:bg-white/5 py-1 pl-1 pr-2.5",
                "text-sea-ink outline-none hover:bg-sand/50 dark:hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-lagoon/40 cursor-pointer transition-all",
              ),
        )}
      >
        <Avatar image={user.image} initial={initial} size={ws ? "xs" : "sm"} workspace={ws} />
        <span
          className={cn(
            "hidden sm:block max-w-[140px] truncate font-medium",
            ws ? "text-[11px]" : "text-xs",
          )}
        >
          {user.name || "Account"}
        </span>
        <ChevronDown className={cn("size-3.5", ws ? "text-ink-label" : "text-sea-ink-soft")} />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[200px] p-1.5 animate-in fade-in zoom-in-95 duration-100",
            ws
              ? "rounded-[4px] border border-rule-strong bg-surface-raised text-ink shadow-lg"
              : "rounded-xl border border-line bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl shadow-lg",
          )}
        >
          {/* Identity block — the useful info, shown plainly */}
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar image={user.image} initial={initial} size="lg" workspace={ws} />
            <div className="min-w-0">
              <p className={cn("truncate text-xs font-semibold", ws ? "text-ink" : "text-sea-ink")}>
                {user.name || "Account"}
              </p>
              <p className={cn("truncate text-[10px]", ws ? "text-ink-label" : "text-sea-ink-soft")}>
                {user.email}
              </p>
            </div>
          </div>

          <DropdownMenu.Separator className={cn("my-1 h-px", ws ? "bg-rule" : "bg-line")} />

          {onWhatsNew && (
            <DropdownMenu.Item onSelect={onWhatsNew} className={itemClass}>
              <Megaphone className={iconClass} />
              What's new
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Item
            onSelect={(e) => {
              // Keep the menu open so the switch is visible.
              e.preventDefault();
              setTheme(isDark ? "light" : "dark");
            }}
            className={itemClass}
          >
            {isDark ? (
              <Sun className={iconClass} />
            ) : (
              <Moon className={iconClass} />
            )}
            {isDark ? "Light theme" : "Dark theme"}
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => {
              navigate({ to: "/sign-out" });
            }}
            className={itemClass}
          >
            <LogOut className={iconClass} />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Avatar({
  image,
  initial,
  size = "sm",
  workspace = false,
}: {
  image?: string | null;
  initial: string;
  size?: "xs" | "sm" | "lg";
  workspace?: boolean;
}) {
  const dimension = size === "lg" ? "size-9" : size === "xs" ? "size-5 text-[10px]" : "size-7";

  if (image) {
    return (
      <img
        src={image}
        alt=""
        className={cn(
          dimension,
          "rounded-full object-cover border border-line",
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        dimension,
        "flex items-center justify-center rounded-full font-semibold",
        workspace
          ? cn("border border-rule-strong bg-surface-page text-brass", size !== "xs" && "text-xs")
          : "border border-lagoon/20 bg-lagoon/10 text-xs text-lagoon",
      )}
    >
      {initial}
    </div>
  );
}
