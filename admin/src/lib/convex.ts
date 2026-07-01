import { ConvexClient } from 'convex/browser';
import { authClient } from './auth-client';

const convexUrl = import.meta.env.VITE_CONVEX_URL || '';

if (!convexUrl) {
  console.warn('Warning: VITE_CONVEX_URL is not configured.');
}

export const convex = new ConvexClient(convexUrl);

convex.setAuth(async () => {
  try {
    const sessionToken = localStorage.getItem('better-auth.session_token') || sessionStorage.getItem('better-auth.session_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    
    const res = await fetch(`${convexUrl}/api/auth/convex/token`, {
      method: 'GET',
      headers,
    });
    
    if (!res.ok) {
      console.error('Error fetching Convex token:', res.status);
      return null;
    }
    const data = await res.json();
    return data?.token || null;
  } catch (err) {
    console.error('Failed to get Convex token:', err);
    return null;
  }
});
