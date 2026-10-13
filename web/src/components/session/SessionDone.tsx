import { useNavigate } from "@tanstack/react-router";
import { AuthButton } from "#/components/auth/AuthButton";
import { SessionPage } from "./SessionPage";

/** The last screen of the session. */
export function SessionDone({ consented }: { consented: boolean }) {
  const navigate = useNavigate();
  return (
    <SessionPage
      step="Session complete"
      title={consented ? "Thank you for taking part" : "Thank you"}
      intro={
        consented ? (
          <p>
            You've finished today's session, and your answers have been saved.
            Your help is making ExemplAI better for future students.
          </p>
        ) : (
          <p>Today's session has ended.</p>
        )
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
