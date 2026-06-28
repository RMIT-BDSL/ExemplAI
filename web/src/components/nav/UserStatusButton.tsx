import { ChevronDown, LogOut } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { authClient } from "#/lib/auth-client";
import { cn } from "#/lib/utils.ts";

/**
 * User status control for the navigation bar.
 *
 * Single responsibility: surface the signed-in user's identity (avatar, name,
 * email) and the sign-out action. Holds no navigation or branding concern.
 */
export default function UserStatusButton() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="size-9 rounded-full bg-sand/60 border border-line" />
    );
  }

  const user = session?.user;
  if (!user) return null;

  const initial = user.name?.charAt(0).toUpperCase() || "U";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "flex items-center gap-2 rounded-full border border-line bg-white/70 py-1 pl-1 pr-2.5",
          "text-sea-ink outline-none hover:bg-sand/45 focus-visible:ring-1 focus-visible:ring-lagoon-deep/40 cursor-pointer",
        )}
      >
        <Avatar image={user.image} initial={initial} />
        <span className="hidden sm:block max-w-[140px] truncate text-sm font-semibold">
          {user.name || "Account"}
        </span>
        <ChevronDown className="size-4 text-sea-ink-soft" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[220px] rounded-xl border border-line bg-white p-1.5 shadow-lg"
        >
          {/* Identity block — the useful info, shown plainly */}
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar image={user.image} initial={initial} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-sea-ink">
                {user.name || "Account"}
              </p>
              <p className="truncate text-xs text-sea-ink-soft">{user.email}</p>
            </div>
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-line" />

          <DropdownMenu.Item
            onSelect={() => void authClient.signOut()}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-sea-ink",
              "outline-none data-[highlighted]:bg-sand/55 cursor-pointer",
            )}
          >
            <LogOut className="size-4 text-sea-ink-soft" />
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
}: {
  image?: string | null;
  initial: string;
  size?: "sm" | "lg";
}) {
  const dimension = size === "lg" ? "size-9" : "size-7";

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
        "flex items-center justify-center rounded-full border border-lagoon/30 bg-lagoon/15 text-xs font-bold text-lagoon-deep",
      )}
    >
      {initial}
    </div>
  );
}
