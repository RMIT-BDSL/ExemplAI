import { useMutation } from "convex/react";
import { AlertCircle, Download } from "lucide-react";
import { useState } from "react";
import { AuthButton } from "#/components/auth/AuthButton";
import { api } from "../../../convex/_generated/api";
import {
  CONSENT_ACKNOWLEDGEMENT,
  CONSENT_PARTS,
  CONSENT_PEOPLE,
  CONSENT_STATEMENTS,
  CONSENT_TITLE,
  consentText,
} from "./consent";
import { SessionPage, stepLabel } from "./SessionPage";

/** Short lines in the sheet that act as sub-headings ("Psychological distress"). */
const isSubheading = (p: string) =>
  p.length < 40 && !/[.:]$/.test(p) && !p.includes("\n");

/** Save the sheet as a text file (the sheet says students may download a copy). */
function downloadCopy() {
  const url = URL.createObjectURL(
    new Blob([consentText()], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "ExemplAI-Participant-Information-Sheet.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function DownloadButton() {
  return (
    <button
      type="button"
      onClick={downloadCopy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-brass hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-brass"
    >
      <Download className="size-3.5" aria-hidden="true" />
      Download a copy
    </button>
  );
}

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
      title="Participant Information Sheet"
      intro={
        <p>Please read this before you start. It takes about three minutes.</p>
      }
    >
      <p className="mb-4 font-serif text-[1.05rem] italic leading-relaxed text-ink">
        {CONSENT_TITLE}
      </p>
      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        {CONSENT_PEOPLE.map((p) => (
          <div key={p.role} className="contents">
            <dt className="text-ink-label">{p.role}</dt>
            <dd className="text-ink">{p.names}</dd>
          </div>
        ))}
      </dl>
      <div className="mb-10">
        <DownloadButton />
      </div>
      <div className="space-y-12">
        {CONSENT_PARTS.map((part) => (
          <div key={part.title} className="space-y-8">
            <h2 className="font-serif text-[1.2rem] font-medium text-ink">
              {part.title}
            </h2>
            {part.sections.map((s) => (
              <section key={s.heading}>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
                  {s.heading}
                </h3>
                <div className="space-y-3 font-serif text-[0.95rem] leading-[1.75] text-ink-prose">
                  {s.paragraphs.map((p) =>
                    isSubheading(p) ? (
                      <p key={p} className="font-medium text-ink">
                        {p}
                      </p>
                    ) : (
                      <p key={p.slice(0, 60)} className="whitespace-pre-line">
                        {p}
                      </p>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        ))}
      </div>

      <section className="mt-10 rounded-[4px] border border-rule-strong bg-surface-panel p-6">
        <h2 className="mb-3 text-sm font-medium text-ink">
          {CONSENT_ACKNOWLEDGEMENT}
        </h2>
        <ul className="mb-6 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-prose">
          {CONSENT_STATEMENTS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <div className="mb-6">
          <DownloadButton />
        </div>
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
              Are you sure you don't want to take part? Today's session will end
              here, and nothing will be recorded for the research.
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
