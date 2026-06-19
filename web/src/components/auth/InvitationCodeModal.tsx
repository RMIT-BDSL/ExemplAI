import * as React from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { AuthTextField } from "./AuthTextField";
import { AuthButton } from "./AuthButton";

interface InvitationCodeModalProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onSubmit: (code: string) => Promise<void>;
  isSubmitting: boolean;
  error: string;
}

export function InvitationCodeModal({
  isOpen,
  email,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: InvitationCodeModalProps) {
  const [code, setCode] = React.useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(code);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--sea-ink)] dark:text-white mb-2">
            Invitation Required
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            An account with <span className="font-semibold text-zinc-900 dark:text-white">{email}</span> was not found. Please enter your invitation code to sign up.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
            <AlertCircle className="size-5 flex-shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AuthTextField
            label="Invitation Code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            leadingIcon={<ShieldCheck className="size-5" />}
            required
            autoFocus
          />

          <div className="flex gap-3 justify-end mt-2">
            <AuthButton
              type="button"
              variant="outlined"
              onClick={onClose}
              className="h-10 text-sm"
              disabled={isSubmitting}
            >
              Cancel
            </AuthButton>
            <AuthButton
              type="submit"
              variant="filled"
              className="h-10 text-sm"
              isLoading={isSubmitting}
              disabled={isSubmitting || !code.trim()}
            >
              Submit & Sign Up
            </AuthButton>
          </div>
        </form>
      </div>
    </div>
  );
}
