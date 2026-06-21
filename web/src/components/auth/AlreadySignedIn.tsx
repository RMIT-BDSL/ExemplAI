import { ShieldCheck, ArrowRight, LogOut } from "lucide-react";
import { AuthButton } from "./AuthButton";

interface AlreadySignedInProps {
  session: {
    user: {
      name?: string | null;
      email?: string | null;
    };
  };
  onGoToDashboard: () => void;
  onSignOut: () => void;
  isSigningOut: boolean;
}

export function AlreadySignedIn({
  session,
  onGoToDashboard,
  onSignOut,
  isSigningOut,
}: AlreadySignedInProps) {
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
              onClick={onGoToDashboard}
            >
              Go to Dashboard
            </AuthButton>

            <AuthButton
              variant="outlined"
              className="w-full h-12 text-base text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/20"
              icon={<LogOut className="size-5" />}
              onClick={onSignOut}
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
