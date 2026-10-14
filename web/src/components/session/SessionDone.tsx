import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { AuthButton } from "#/components/auth/AuthButton";
import { api } from "../../../convex/_generated/api";
import { SessionPage } from "./SessionPage";

/** The last screen of the session. */
export function SessionDone() {
  const navigate = useNavigate();
  return (
    <SessionPage
      step="Session complete"
      title="Thank you for taking part"
      intro={
        <p>
          You've finished today's session, and your answers have been saved.
          Your help is making ExemplAI better for future students.
        </p>
      }
    >
      <div className="space-y-6 font-serif text-[0.95rem] leading-[1.75] text-ink-prose">
        <p>
          Please sign out before you leave, especially on a shared computer.
        </p>
        <AuthButton
          variant="outlined"
          onClick={() => navigate({ to: "/sign-out" })}
        >
          Sign out
        </AuthButton>
      </div>
    </SessionPage>
  );
}

/**
 * After declining to take part: the session ends here and nothing more is
 * recorded (the admin roster shows them as declined). A misclick can still
 * be undone.
 */
export function SessionDeclined() {
  const navigate = useNavigate();
  const giveConsent = useMutation(api.cohorts.giveConsent);
  const [saving, setSaving] = useState(false);
  return (
    <SessionPage
      title="You've chosen not to take part"
      intro={
        <p>
          Thank you for letting us know. Nothing from today will be recorded for
          the research, and your decision won't affect your course.
        </p>
      }
    >
      <div className="space-y-6 font-serif text-[0.95rem] leading-[1.75] text-ink-prose">
        <p>
          Please sign out before you leave, especially on a shared computer.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <AuthButton
            variant="filled"
            onClick={() => navigate({ to: "/sign-out" })}
          >
            Sign out
          </AuthButton>
          <AuthButton
            variant="text"
            isLoading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await giveConsent({ agree: true });
              } finally {
                setSaving(false);
              }
            }}
          >
            I clicked by mistake: take part
          </AuthButton>
        </div>
      </div>
    </SessionPage>
  );
}
