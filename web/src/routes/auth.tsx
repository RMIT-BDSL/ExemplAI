import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Mail,
  Lock,
  User,
  LogOut,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { authClient } from "#/lib/auth-client";
import { AuthCard } from "#/components/auth/AuthCard";
import { AuthTabs } from "#/components/auth/AuthTabs";
import { AuthTextField } from "#/components/auth/AuthTextField";
import { AuthButton } from "#/components/auth/AuthButton";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { data: session, isPending: isSessionLoading } = authClient.useSession();

  const [activeTab, setActiveTab] = React.useState<"signin" | "signup" | "magiclink">("signin");
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState("");
  const [globalError, setGlobalError] = React.useState("");

  // Initialize TanStack Form with centralized validators
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setGlobalError("");
      setSuccessMessage("");

      try {
        if (activeTab === "signin") {
          const { error } = await authClient.signIn.email({
            email: value.email,
            password: value.password,
          });
          if (error) {
            setGlobalError(error.message || "Invalid email or password");
          } else {
            navigate({ to: "/" });
          }
        } else if (activeTab === "magiclink") {
          // Log magic link request to the terminal/console
          console.log(`[Auth] Magic Link Sign In initiated for email: "${value.email}"`);

          const { error } = await authClient.signIn.magicLink({
            email: value.email,
            callbackURL: "/",
          });
          if (error) {
            setGlobalError(error.message || "Failed to send magic link");
          } else {
            setSuccessMessage(
              "Magic link sent! Please check your email inbox."
            );
          }
        } else {
          const { error } = await authClient.signUp.email({
            email: value.email,
            password: value.password,
            name: value.name,
          });
          if (error) {
            setGlobalError(error.message || "Failed to create account");
          } else {
            navigate({ to: "/" });
          }
        }
      } catch (err: any) {
        setGlobalError(err.message || "An unexpected error occurred. Please try again.");
      }
    },
  });

  // Reset form values and message states when tab changes
  React.useEffect(() => {
    form.reset();
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
      <div className="flex min-h-screen w-full items-center justify-center p-4">
        <div className="w-full max-w-[460px] animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out">
          <div className="relative overflow-hidden rounded-[28px] border border-zinc-200/60 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/75 backdrop-blur-xl shadow-2xl p-8 md:p-10 text-center">
            {/* Background Glows */}
            <div className="absolute -top-12 -right-12 size-40 bg-[var(--lagoon)]/10 dark:bg-[var(--lagoon)]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 size-40 bg-[var(--palm)]/10 dark:bg-[var(--palm)]/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-center size-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-6 mx-auto">
              <ShieldCheck className="size-10" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[var(--sea-ink)] dark:text-white display-title mb-2">
              Already Signed In
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
              Welcome back,{" "}
              <span className="font-semibold text-zinc-900 dark:text-white">
                {session.user.name}
              </span>
              . You are currently logged in with{" "}
              <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                {session.user.email}
              </span>
              .
            </p>

            <div className="flex flex-col gap-3">
              <AuthButton
                variant="filled"
                className="w-full h-12 text-base"
                icon={<ArrowRight className="size-5" />}
                onClick={() => navigate({ to: "/" })}
              >
                Go to Dashboard
              </AuthButton>

              <AuthButton
                variant="outlined"
                className="w-full h-12 text-base text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/20"
                icon={<LogOut className="size-5" />}
                onClick={handleSignOut}
                isLoading={isSigningOut}
              >
                Sign Out
              </AuthButton>
            </div>
          </div>
        </div>
      </div>
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

        {/* Authentication Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-5"
        >
          {activeTab === "signup" && (
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  if (!value.trim()) {
                    return "Name is required";
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <AuthTextField
                  label="Full Name"
                  type="text"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  error={
                    field.state.meta.errors
                      ? field.state.meta.errors.join(", ")
                      : undefined
                  }
                  leadingIcon={<User className="size-5" />}
                  required
                />
              )}
            </form.Field>
          )}

          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                if (!value) {
                  return "Email is required";
                }
                if (!/\S+@\S+\.\S+/.test(value)) {
                  return "Please enter a valid email address";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <AuthTextField
                label="Email Address"
                type="email"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                error={
                  field.state.meta.errors
                    ? field.state.meta.errors.join(", ")
                    : undefined
                }
                leadingIcon={<Mail className="size-5" />}
                required
              />
            )}
          </form.Field>

          {activeTab !== "magiclink" && (
            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) => {
                  if (!value) {
                    return "Password is required";
                  }
                  if (value.length < 8) {
                    return "Password must be at least 8 characters";
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <AuthTextField
                  label="Password"
                  type="password"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  error={
                    field.state.meta.errors
                      ? field.state.meta.errors.join(", ")
                      : undefined
                  }
                  leadingIcon={<Lock className="size-5" />}
                  required
                />
              )}
            </form.Field>
          )}

          {activeTab === "signin" && (
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                className="text-xs font-semibold text-zinc-500 hover:underline outline-none cursor-pointer"
                onClick={() => {
                  setGlobalError(
                    "Password reset is not configured yet. Please contact your administrator."
                  );
                }}
              >
                Forgot Password?
              </button>
            </div>
          )}

          {/* Form helper component to bind submission capability */}
          <form.Subscribe selector={(state) => [state.isSubmitting]}>
            {([isSubmitting]) => (
              <AuthButton
                type="submit"
                variant="filled"
                className="w-full h-12 text-base mt-2"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                icon={<ArrowRight className="size-5" />}
              >
                {activeTab === "signup"
                  ? "Sign Up"
                  : activeTab === "magiclink"
                    ? "Send Magic Link"
                    : "Sign In"}
              </AuthButton>
            )}
          </form.Subscribe>
        </form>
      </AuthCard>

    </div>
  );
}
