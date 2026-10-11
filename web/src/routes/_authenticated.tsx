import { usePostHog } from "@posthog/react";
import { useEffect, useState } from "react";
import { createFileRoute, Outlet, redirect, useMatches, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { isIdEmail } from "../../convex/studentIds";
import { IntakeSurvey } from "#/components/intake/IntakeSurvey";
import { stripSearchParams } from "#/lib/auth-callback";
import { /* captureSignIn, */ getSession } from "#/lib/auth.functions";
import Navbar from "#/components/nav/Navbar";

interface AuthenticatedSearch {
  code?: string;
  // magic?: boolean;
}

export const Route = createFileRoute("/_authenticated")({
  validateSearch: (search: Record<string, unknown>): AuthenticatedSearch => {
    return {
      code: typeof search.code === "string" ? search.code : undefined,
      // magic: search.magic === "1" || search.magic === true,
    };
  },
  beforeLoad: async ({ location }) => {
    const session = await getSession();

    if (!session?.user) {
      throw redirect({
        to: "/auth",
        search: {
          redirect: location.href,
        },
      });
    }

    return { session };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session } = Route.useRouteContext();
  const { code /*, magic */ } = Route.useSearch();
  const navigate = useNavigate();
  const isWorkspace = useMatches().some((m) => m.routeId === "/_authenticated/course");
  const posthog = usePostHog();
  const createUserAndUseCode = useMutation(api.invitationCodes.createUserAndUseCode);

  // Student-ID sign-in (convex/studentIds.ts): place the student in their
  // cohort, record the sign-in and set their group before any page loads (the
  // pages need the profile this creates), then ask the intake survey once.
  const isIdAccount = isIdEmail(session?.user?.email);
  const { isAuthenticated } = useConvexAuth();
  const joinWithId = useMutation(api.cohorts.joinWithId);
  const [joined, setJoined] = useState(!isIdAccount);
  const [joinError, setJoinError] = useState("");
  useEffect(() => {
    if (!isIdAccount || !isAuthenticated) return;
    joinWithId({})
      .then(() => setJoined(true))
      .catch((err) => {
        setJoinError(err.message || "Couldn't open your course.");
        posthog.captureException(err);
      });
  }, [isIdAccount, isAuthenticated, joinWithId, posthog]);
  const intake = useQuery(api.cohorts.myIntake, isIdAccount && joined ? {} : "skip");

  // Magic-link sign-in completion: the user followed the link in their email and
  // landed here authenticated. This is the only point where a magic-link sign-in
  // is observable, so identify the user and capture the event (client + server).
  /*
  useEffect(() => {
    if (!session?.user || !magic) return;

    posthog.identify(session.user.email, {
      email: session.user.email,
      name: session.user.name || undefined,
    });
    posthog.capture("user_signed_in", { method: "magic_link" });

    // Mirror server-side so the event survives a client disconnect.
    captureSignIn({
      data: {
        distinctId: session.user.email,
        method: "magic_link",
        email: session.user.email,
      },
    }).catch((err) => {
      console.error("Failed to capture sign-in server-side:", err);
      posthog.captureException(err);
    });

    // Strip the `magic` marker so a refresh doesn't re-fire the event.
    navigate({
      search: (prev: any) => stripSearchParams(prev, ["magic"]),
      replace: true,
    });
  }, [session, magic, posthog, navigate]);
  */

  useEffect(() => {
    if (session?.user && code) {
      createUserAndUseCode({
        email: session.user.email,
        name: session.user.name || undefined,
        image: session.user.image || undefined,
        code: code,
        tokenIdentifier: session.user.id,
      })
        .then(() => {
          console.log("Successfully synced user to Convex and redeemed invitation code.");
          // Remove the code parameter from the search query after success
          navigate({
            search: (prev: any) => stripSearchParams(prev, ["code"]),
            replace: true,
          });
        })
        .catch((err) => {
          console.error("Failed to sync user and redeem code in Convex:", err);
          posthog.captureException(err);
        });
    }
  }, [session, code, createUserAndUseCode, navigate, posthog]);

  if (isIdAccount && (!joined || intake === undefined)) {
    return (
      <div className="xa-workspace flex min-h-dvh w-full items-center justify-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-label">
          {joinError || "Opening your course..."}
        </p>
      </div>
    );
  }
  if (intake?.needsIntake) return <IntakeSurvey questions={intake.questions} />;

  return (
    <>
      {/* The lesson workspace has its own status bar instead. */}
      {!isWorkspace && <Navbar />}
      <Outlet />
    </>
  );
}
