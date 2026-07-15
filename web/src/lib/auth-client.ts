import { createAuthClient } from 'better-auth/react'
// import { magicLinkClient } from 'better-auth/client/plugins'
import { convexClient } from '@convex-dev/better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [
    // magicLinkClient(),
    convexClient()
  ],
  // Don't refetch the session when the tab regains focus. The default (true)
  // fires `/get-session` on every `visibilitychange`, which flips `isPending`
  // back to true and tears the auth form down to the full-screen "Checking
  // credentials..." spinner on every refocus.
  sessionOptions: {
    refetchOnWindowFocus: false,
  },
})

