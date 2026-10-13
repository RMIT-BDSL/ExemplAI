import { useMutation } from "convex/react";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { AuthButton } from "#/components/auth/AuthButton";
import { api } from "../../../convex/_generated/api";
import { CONSENT_SECTIONS, CONSENT_STATEMENTS, CONSENT_TITLE } from "./consent";
import { SessionPage, stepLabel } from "./SessionPage";

/** Participant information, then agree or decline (convex/cohorts.ts giveConsent). */
export function ConsentScreen() {
  const giveConsent = useMutation(api.cohorts.giveConsent);
  const [saving, setSaving] = useState<"agree" | "decline" | null>(null);
  const [error, setError] = useState("");
  // Declining asks again first, so a misclick doesn't opt a student out.
  const [confirmDecline, setConfirmDecline] = useState(false);

  const answer = async (agree: boolean) => {
    setSaving(agree ? "agree" : "decline");
    setError("");
    try {
      await giveConsent({ agree });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save your answer. Please try again.",
      );
      setSaving(null);
    }
  };

  return (
    <SessionPage
      step={stepLabel(0)}
      title="Participant information"
      intro={
        <p>Please read this before you start. It takes about three minutes.</p>
      }
    >
      <p className="mb-8 font-serif text-[1.05rem] italic leading-relaxed text-ink">
        {CONSENT_TITLE}
      </p>
      <div className="space-y-8">
        {CONSENT_SECTIONS.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
              {s.heading}
            </h2>
            <div className="space-y-3 font-serif text-[0.95rem] leading-[1.75] text-ink-prose">
              {s.paragraphs.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10 rounded-[4px] border border-rule-strong bg-surface-panel p-6">
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
          Consent
        </h2>
        <p className="mb-3 text-sm text-ink">
          By choosing "I agree to take part":
        </p>
        <ul className="mb-6 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-prose">
          {CONSENT_STATEMENTS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2.5 rounded-[2px] border border-danger px-3 py-2.5 text-xs text-danger"
          >
            <AlertCircle className="mt-px size-4 flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}
        {confirmDecline ? (
          <div className="rounded-[2px] border border-rule-strong p-4">
            <p className="mb-4 text-sm leading-relaxed text-ink">
              Are you sure you don't want to take part? You can still do the
              exercises, but nothing you do today will be used in the research.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <AuthButton
                variant="filled"
                disabled={saving !== null}
                onClick={() => setConfirmDecline(false)}
              >
                Go back
              </AuthButton>
              <AuthButton
                variant="outlined"
                isLoading={saving === "decline"}
                disabled={saving !== null}
                onClick={() => answer(false)}
              >
                Yes, I don't want to take part
              </AuthButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <AuthButton
              variant="filled"
              isLoading={saving === "agree"}
              disabled={saving !== null}
              onClick={() => answer(true)}
            >
              I agree to take part
            </AuthButton>
            <AuthButton
              variant="outlined"
              disabled={saving !== null}
              onClick={() => setConfirmDecline(true)}
            >
              I don't want to take part
            </AuthButton>
          </div>
        )}
      </section>
    </SessionPage>
  );
}
