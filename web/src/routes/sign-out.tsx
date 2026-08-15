import { usePostHog } from "@posthog/react";
import { createFileRoute } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/sign-out")({
  component: SignOutPage,
});

function SignOutPage() {
  const posthog = usePostHog();
  const [status, setStatus] = useState<"signing_out" | "error">("signing_out");

  useEffect(() => {
    let isMounted = true;

    async function performSignOut() {
      try {
        posthog.capture("user_signed_out");
        await authClient.signOut();
        posthog.reset();
        window.location.href = "/auth";
      } catch (err) {
        console.error("Sign out failed:", err);
        posthog.captureException(err);
        if (isMounted) {
          setStatus("error");
        }
      }
    }

    performSignOut();

    return () => {
      isMounted = false;
    };
  }, [posthog]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[var(--bg-base)] text-sea-ink">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-8 text-center shadow-xl">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-sand dark:bg-white/10 text-lagoon mb-4">
          <LogOut className="size-6 animate-pulse" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-sea-ink">
          {status === "signing_out" ? "Signing out..." : "Failed to sign out"}
        </h1>
        <p className="mt-1 text-xs text-sea-ink-soft">
          {status === "signing_out"
            ? "Clearing your session and redirecting to sign in..."
            : "An error occurred while signing out. Click below to return to the sign in page."}
        </p>

        {status === "error" && (
          <button
            onClick={() => {
              window.location.href = "/auth";
            }}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-lagoon px-4 py-2 text-xs font-semibold text-white hover:bg-lagoon-deep transition-colors cursor-pointer"
          >
            Go to Sign In
          </button>
        )}
      </div>
    </div>
  );
}
