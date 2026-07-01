import { ConvexClient } from 'convex/browser';
import { authClient } from './auth-client';

const convexUrl = import.meta.env.VITE_CONVEX_URL || '';

if (!convexUrl) {
  console.warn('Warning: VITE_CONVEX_URL is not configured.');
}

export const convex = new ConvexClient(convexUrl);

convex.setAuth(async () => {
  try {
    const { data, error } = await authClient.convex.getToken();
    if (error) {
      console.error('Error fetching Convex token:', error);
      return null;
    }
    return data?.token || null;
  } catch (err) {
    console.error('Failed to get Convex token:', err);
    return null;
  }
});
