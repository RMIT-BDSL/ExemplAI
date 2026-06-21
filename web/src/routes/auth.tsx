import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { authClient } from "#/lib/auth-client";
import { AuthCard } from "#/components/auth/AuthCard";
import { AuthTabs } from "#/components/auth/AuthTabs";
import { AlreadySignedIn } from "#/components/auth/AlreadySignedIn";
import { InvitationCodeModal } from "#/components/auth/InvitationCodeModal";
import { SignInForm } from "#/components/auth/forms/SignInForm";
import { SignUpForm } from "#/components/auth/forms/SignUpForm";
import { MagicLinkForm } from "#/components/auth/forms/MagicLinkForm";

interface AuthSearch {
  redirect?: string;
}

export function sanitizeRedirect(
  redirect: string,
  allowedOrigin: string = window.location.origin
): string {
  if (!redirect) return "/";

  try {
    const url = new URL(redirect, allowedOrigin);

    const envOrigins = (import.meta.env.VITE_TRUSTED_ORIGINS || "")
      .split(",")
      .map((item: string) => item.trim())
      .filter(Boolean);

    const allowedOrigins = [allowedOrigin, ...envOrigins].map((origin) =>
      origin.toLowerCase()
    );

    if (!allowedOrigins.includes(url.origin.toLowerCase())) {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    return {
      redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    };
  },
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const convex = useConvex();

  const [activeTab, setActiveTab] = React.useState<"signin" | "signup" | "magiclink">("signin");
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState("");
  const [globalError, setGlobalError] = React.useState("");

  // Magic Link Invitation Code Modal States
  const [showMagicCodeModal, setShowMagicCodeModal] = React.useState(false);
  const [magicEmail, setMagicEmail] = React.useState("");
  const [modalError, setModalError] = React.useState("");
  const [isSubmittingModal, setIsSubmittingModal] = React.useState(false);

  // Handle invitation code submission for magic link new users
  const handleModalSubmit = async (codeToSubmit: string) => {
    setModalError("");
    setIsSubmittingModal(true);

    try {
      // 1. Validate invitation code in Convex
      const validation = await convex.query(api.invitationCodes.validateCode, {
        code: codeToSubmit,
      });
      if (!validation.isValid) {
        setModalError(validation.reason || "Invalid invitation code.");
        setIsSubmittingModal(false);
        return;
      }

      // 2. Request magic link with the invitation code attached to callback URL
      const redirectUrl = sanitizeRedirect(redirect || "/");
      const finalCallback = `${redirectUrl}${redirectUrl.includes("?") ? "&" : "?"}code=${encodeURIComponent(codeToSubmit)}`;

      const { error } = await authClient.signIn.magicLink({
        email: magicEmail,
        callbackURL: finalCallback,
      });

      if (error) {
        setModalError(error.message || "Failed to send magic link.");
      } else {
        setShowMagicCodeModal(false);
        setSuccessMessage(
          "Magic link sent! Once you click it in your email, your account will be created."
        );
      }
    } catch (err: any) {
      setModalError(err.message || "An error occurred.");
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Reset message states when tab changes
  React.useEffect(() => {
    setGlobalError("");
    setSuccessMessage("");
  }, [activeTab]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      navigate({ to: "/auth" });
    } catch (err: any) {
      setGlobalError("Failed to sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  // Session loading skeleton
  if (isSessionLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[var(--bg-base)] text-[var(--sea-ink)]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 rounded-full border-4 border-zinc-200 border-t-[var(--lagoon-deep)] animate-spin" />
          <p className="text-sm font-semibold tracking-wider animate-pulse">
            Checking credentials...
          </p>
        </div>
      </div>
    );
  }

  // Already authenticated UI
  if (session?.user) {
    return (
      <AlreadySignedIn
        session={session}
        onGoToDashboard={() => navigate({ to: sanitizeRedirect(redirect || "/") })}
        onSignOut={handleSignOut}
        isSigningOut={isSigningOut}
      />
    );
  }

  // Login / Register Form
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <AuthCard
        title={
          activeTab === "signin"
            ? "Welcome Back"
            : activeTab === "magiclink"
              ? "Magic Link"
              : "Create Account"
        }
        subtitle={
          activeTab === "signin"
            ? "Sign in with your email and password to access the platform."
            : activeTab === "magiclink"
              ? "Enter your email to receive a passwordless sign-in link."
              : "Sign up to start tracking your learning progress and assignments."
        }
      >
        {/* M3 Segmented Tabs */}
        <AuthTabs activeTab={activeTab} onChange={setActiveTab} />

        {/* Global Error Banner */}
        {globalError && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="size-5 flex-shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">{globalError}</p>
          </div>
        )}

        {/* Global Success Banner */}
        {successMessage && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="size-5 flex-shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">{successMessage}</p>
          </div>
        )}

        {/* Render appropriate form component */}
        {activeTab === "signin" && (
          <SignInForm
            onSuccess={() => navigate({ to: sanitizeRedirect(redirect || "/") })}
            onError={setGlobalError}
          />
        )}

        {activeTab === "signup" && (
          <SignUpForm
            onSuccess={() => navigate({ to: sanitizeRedirect(redirect || "/") })}
            onError={setGlobalError}
          />
        )}

        {activeTab === "magiclink" && (
          <MagicLinkForm
            onSuccess={() => setSuccessMessage("Magic link sent! Please check your email inbox.")}
            onUserNotFound={(email) => {
              setMagicEmail(email);
              setModalError("");
              setShowMagicCodeModal(true);
            }}
            onError={setGlobalError}
            redirectUrl={sanitizeRedirect(redirect || "/")}
          />
        )}
      </AuthCard>

      {/* Magic Link Invitation Code Popup Modal */}
      <InvitationCodeModal
        isOpen={showMagicCodeModal}
        email={magicEmail}
        onClose={() => setShowMagicCodeModal(false)}
        onSubmit={handleModalSubmit}
        isSubmitting={isSubmittingModal}
        error={modalError}
      />
    </div>
  );
}
