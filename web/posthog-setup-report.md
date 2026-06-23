<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into ExemplAI, a TanStack Start coding education platform. The integration includes:

- **Client-side initialization** via `PostHogProvider` in `src/routes/__root.tsx`, wrapping the entire app with session replay, exception capture, and a reverse proxy config.
- **Reverse proxy** in `vite.config.ts` routing `/ingest/*` to the EU PostHog hosts, improving reliability and bypassing ad-blockers.
- **User identification** on email sign-in and sign-up, so returning sessions are correlated to named users.
- **Auth event tracking** across all three sign-in paths (email/password, sign-up with invite code, magic link).
- **Learning engagement tracking** in the course workspace — code runs, submissions, resets, and AI chat opens.
- **Error tracking** (`captureException`) on auth failures and code execution errors.
- **Server-side PostHog client** created as a singleton in `src/utils/posthog-server.ts` for future API-route tracking.

## Events

| Event | Description | File |
|---|---|---|
| `user_signed_in` | User successfully signs in with email and password. | `src/components/auth/forms/SignInForm.tsx` |
| `user_signed_up` | User creates a new account using the sign-up form with an invitation code. | `src/components/auth/forms/SignUpForm.tsx` |
| `magic_link_requested` | User requests a passwordless magic link to their email. | `src/components/auth/forms/MagicLinkForm.tsx` |
| `invitation_code_submitted` | User submits an invitation code during the magic link new-user flow. | `src/routes/auth.tsx` |
| `user_signed_out` | User signs out from an already-authenticated session. | `src/routes/auth.tsx` |
| `problem_started` | User clicks Start, Resume, or Review to open a coding problem. | `src/components/home/CourseList.tsx` |
| `code_run` | User runs their code in the workspace editor. | `src/routes/_authenticated.course.tsx` |
| `code_submitted` | User submits their solution for a coding problem. | `src/routes/_authenticated.course.tsx` |
| `code_reset` | User confirms resetting their code back to the default template. | `src/routes/_authenticated.course.tsx` |
| `ai_chat_opened` | User opens the AI assistant chat panel in the coding workspace. | `src/routes/_authenticated.course.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) Dashboard](https://eu.posthog.com/project/206544/dashboard/763020)
- [Auth Funnel: Sign-up to First Problem](https://eu.posthog.com/project/206544/insights/lvQBiemO)
- [New Users Over Time](https://eu.posthog.com/project/206544/insights/2F6Mf6zd)
- [Code Activity: Runs vs Submissions](https://eu.posthog.com/project/206544/insights/Rgyb1edM)
- [AI Chat Adoption](https://eu.posthog.com/project/206544/insights/UKgy4nwH)
- [Problem Engagement Funnel](https://eu.posthog.com/project/206544/insights/Jm78o2sE)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — currently `identify` is called only on fresh sign-in and sign-up; users who return via a persisted session (Better Auth's `useSession()`) are not re-identified on load. Consider calling `posthog.identify(session.user.email, ...)` inside `_authenticated.tsx` when a session is present.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
