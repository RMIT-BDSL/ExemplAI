import { useEffect } from "react";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getSession } from "#/lib/auth.functions";

interface AuthenticatedSearch {
  code?: string;
}

export const Route = createFileRoute("/_authenticated")({
  validateSearch: (search: Record<string, unknown>): AuthenticatedSearch => {
    return {
      code: typeof search.code === "string" ? search.code : undefined,
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
  const { code } = Route.useSearch();
  const navigate = useNavigate();
  const createUserAndUseCode = useMutation(api.invitationCodes.createUserAndUseCode);

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
            search: (prev: any) => {
              const { code: _, ...rest } = prev;
              return rest;
            },
            replace: true,
          });
        })
        .catch((err) => {
          console.error("Failed to sync user and redeem code in Convex:", err);
        });
    }
  }, [session, code, createUserAndUseCode, navigate]);

  return <Outlet />;
}
