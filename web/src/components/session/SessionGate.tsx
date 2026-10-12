import { useMutation, useQuery } from "convex/react";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import {
  POST_SURVEY,
  PRE_SURVEY,
  type SurveyAnswers,
} from "../../../convex/surveys";
import { ConnectionNotice } from "./ConnectionNotice";
import { ConsentScreen } from "./ConsentScreen";
import { SessionDone } from "./SessionDone";
import { stepLabel } from "./SessionPage";
import { SessionTimer } from "./SessionTimer";
import { SurveyScreen } from "./SurveyScreen";

/** The current time, ticking every second while `active`. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/**
 * The study session as one linear flow for a cohort student (convex/cohorts.ts):
 * consent, pre-survey, the exercises (the app itself, timed), post-survey,
 * completion. In open practice, only consent and the pre-survey come first.
 * Staff and other accounts outside a cohort pass straight through.
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
  const timed = session?.stage === "exercises" && session.endsAt !== null;
  const now = useNow(timed);
  // A query can't watch the clock, so the exercises end here when time is up.
  const endsAt = session?.endsAt ?? 0;
  const timeUp = timed && now >= endsAt;
  const stage = timeUp
    ? session?.consented
      ? "post_survey"
      : "done"
    : session?.stage;
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
  return (
    <>
      <Screen
        session={session}
        stage={stage}
        userId={userId}
        timed={timed}
        msLeft={endsAt - now}
        onSaveDraft={(survey, answers) => saveDraft({ survey, answers })}
        onSubmitPre={(answers) => submitPre({ answers })}
        onSubmitPost={(answers) => submitPost({ answers })}
      >
        {children}
      </Screen>
      <ConnectionNotice />
    </>
  );
}

type Session = NonNullable<FunctionReturnType<typeof api.cohorts.mySession>>;

function Screen({
  session,
  stage,
  userId,
  timed,
  msLeft,
  onSaveDraft,
  onSubmitPre,
  onSubmitPost,
  children,
}: {
  session: Session;
  stage: string | undefined;
  userId: string;
  timed: boolean;
  msLeft: number;
  onSaveDraft: (
    survey: "pre" | "post",
    answers: SurveyAnswers,
  ) => Promise<unknown>;
  onSubmitPre: (answers: SurveyAnswers) => Promise<unknown>;
  onSubmitPost: (answers: SurveyAnswers) => Promise<unknown>;
  children: ReactNode;
}) {
  switch (stage) {
    case "consent":
      return <ConsentScreen />;
    case "pre_survey":
      return (
        <SurveyScreen
          storageKey={`exemplai-pre-survey-${userId}`}
          step={stepLabel(1)}
          title="About you"
          intro="A few questions about your background and experience. It takes about three minutes. There are no right or wrong answers."
          sections={PRE_SURVEY}
          submitLabel="Start the exercises"
          serverDraft={session.drafts.pre}
          onSaveDraft={(answers) => onSaveDraft("pre", answers)}
          onSubmit={onSubmitPre}
        />
      );
    case "post_survey":
      return (
        <SurveyScreen
          storageKey={`exemplai-post-survey-${userId}`}
          step={stepLabel(3)}
          title="Your experience"
          intro="Time's up for the exercises. Please tell us how today went. It takes about four minutes, and your honest answers help most."
          sections={POST_SURVEY}
          submitLabel="Submit and finish"
          serverDraft={session.drafts.post}
          onSaveDraft={(answers) => onSaveDraft("post", answers)}
          onSubmit={onSubmitPost}
        />
      );
    case "done":
      return <SessionDone consented={session.consented === true} />;
    default:
      return (
        <>
          {children}
          {timed && (
            <SessionTimer
              msLeft={msLeft}
              consented={session.consented === true}
              testingGroup={session.testingGroup}
            />
          )}
        </>
      );
  }
}
