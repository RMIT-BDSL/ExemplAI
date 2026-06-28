import { createAuthClient } from 'better-auth/solid';
import { magicLinkClient } from 'better-auth/client/plugins';
import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins';

const betterAuthUrl = import.meta.env.VITE_CONVEX_SITE_URL || '';

if (!betterAuthUrl) {
  console.warn('Warning: VITE_CONVEX_SITE_URL is not configured.');
}

export const authClient = createAuthClient({
  baseURL: `${betterAuthUrl}/api/auth`,
  plugins: [
    magicLinkClient(),
    convexClient(),
    crossDomainClient()
  ]
});

export const { useSession } = authClient;
