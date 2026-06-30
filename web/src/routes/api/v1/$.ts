import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handlePostHogProxy(request, params._splat),
      POST: ({ request, params }) => handlePostHogProxy(request, params._splat),
    },
  },
});

async function handlePostHogProxy(request: Request, splat: string) {
  // Determine targets based on the request path
  const isAsset = splat.startsWith("static/") || splat.startsWith("array/");
  const targetBase = isAsset
    ? "https://eu-assets.i.posthog.com"
    : "https://eu.i.posthog.com";

  const requestUrlObj = new URL(request.url);
  const targetUrl = `${targetBase}/${splat}${requestUrlObj.search}`;

  // Clone headers and set IP forwarding headers for accurate geo/IP analytics
  const headers = new Headers(request.headers);
  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for") ||
    "";
  if (clientIp) {
    headers.set("x-forwarded-for", clientIp);
    headers.set("x-real-ip", clientIp);
  }

  const targetUrlObj = new URL(targetUrl);
  headers.set("host", targetUrlObj.host);

  // Construct fetch options
  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    fetchOptions.body = request.body;
    // Required by Cloudflare Workers for fetch requests with streaming bodies
    // @ts-ignore
    fetchOptions.duplex = "half";
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error("Error proxying to PostHog:", error);
    return new Response("Error proxying to PostHog", { status: 502 });
  }
}
