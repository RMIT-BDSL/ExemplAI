import { useMutation, useQuery } from "convex/react";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { nextDeadline, stageAt } from "../../../convex/sessionFlow";
import { POST_SURVEY, PRE_SURVEY } from "../../../convex/surveys";
import { ConnectionNotice } from "./ConnectionNotice";
import { ConsentScreen } from "./ConsentScreen";
import { QuickCheckScreen } from "./QuickCheckScreen";
import { SessionDeclined, SessionDone } from "./SessionDone";
import { stepLabel } from "./SessionPage";
import { SessionTimer } from "./SessionTimer";
import { SurveyScreen } from "./SurveyScreen";

/** Re-renders every second while `active` (a clock is running). */
function useTick(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
}

/**
 * The study session as one linear flow for a cohort student
 * (convex/sessionFlow.ts): consent, pre-survey, quick check, the exercises
 * (the app itself, timed), quick check, post-survey, completion. In open
 * practice, only consent and the pre-survey come first. Staff and other
 * accounts outside a cohort pass straight through.
 */
export function SessionGate({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const session = useQuery(api.cohorts.mySession);
  const submitPre = useMutation(api.cohorts.submitPreSurvey);
  const submitPost = useMutation(api.cohorts.submitPostSurvey);
  const saveDraft = useMutation(api.cohorts.saveSurveyDraft);

  // A query can't watch the clock, so the page moves on when a deadline passes.
  const flow = session?.flow;
  const now = Date.now();
  useTick(!!flow && nextDeadline(flow, now) !== null);
  const stage = flow ? stageAt(flow, now) : undefined;

  // Each step starts at the top (the previous screen may have been scrolled).
  // biome-ignore lint/correctness/useExhaustiveDependencies: on each new step
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage]);

  if (session === undefined) {
    return (
      <div className="xa-workspace flex min-h-dvh w-full items-center justify-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-label">
          Opening your course...
        </p>
      </div>
    );
  }
  if (session === null) return <>{children}</>;

  let screen: ReactNode;
  switch (stage) {
    case "consent":
      screen = <ConsentScreen />;
      break;
    case "pre_survey":
      screen = (
        <SurveyScreen
          storageKey={`exemplai-pre-survey-${userId}`}
          step={stepLabel(1)}
          title="About you"
          intro="A few questions about your background and experience. It takes about three minutes. There are no right or wrong answers."
          sections={PRE_SURVEY}
          submitLabel="Continue"
          serverDraft={session.drafts.pre}
          onSaveDraft={(answers) => saveDraft({ survey: "pre", answers })}
          onSubmit={(answers) => submitPre({ answers })}
        />
      );
      break;
    case "pre_check":
      screen = <QuickCheckScreen phase="pre" step={stepLabel(2)} />;
      break;
    case "post_check":
      screen = <QuickCheckScreen phase="post" step={stepLabel(4)} />;
      break;
    case "post_survey":
      screen = (
        <SurveyScreen
          storageKey={`exemplai-post-survey-${userId}`}
          step={stepLabel(5)}
          title="Your experience"
          intro="Please tell us how today went. It takes about four minutes, and your honest answers help most."
          sections={POST_SURVEY}
          submitLabel="Submit and finish"
          serverDraft={session.drafts.post}
          onSaveDraft={(answers) => saveDraft({ survey: "post", answers })}
          onSubmit={(answers) => submitPost({ answers })}
        />
      );
      break;
    case "done":
      screen = <SessionDone />;
      break;
    case "declined":
      screen = <SessionDeclined />;
      break;
    default: {
      const endsAt =
        stage === "exercises" ? session.flow.timeline.exercisesEndsAt : null;
      screen = (
        <>
          {children}
          {endsAt !== null && (
            <SessionTimer
              msLeft={endsAt - now}
              hasChecks={session.flow.hasChecks}
              testingGroup={session.testingGroup}
            />
          )}
        </>
      );
    }
  }
  return (
    <>
      {screen}
      <ConnectionNotice />
    </>
  );
}
