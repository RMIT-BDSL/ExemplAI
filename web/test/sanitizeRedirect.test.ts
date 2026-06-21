import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sanitizeRedirect } from "../src/routes/auth";

describe("sanitizeRedirect security & functionality tests", () => {
  let originalEnv: any;

  beforeEach(() => {
    originalEnv = import.meta.env.VITE_TRUSTED_ORIGINS;
    import.meta.env.VITE_TRUSTED_ORIGINS = "https://anotherapp.com,http://localhost:3001";
    // Mock window.location
    vi.stubGlobal("window", {
      location: {
        origin: "http://localhost:3000"
      }
    });
  });

  afterEach(() => {
    import.meta.env.VITE_TRUSTED_ORIGINS = originalEnv;
    vi.unstubAllGlobals();
  });

  it("should allow safe relative paths", () => {
    expect(sanitizeRedirect("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirect("/dashboard?user=123#tab-1")).toBe("/dashboard?user=123#tab-1");
  });

  it("should allow absolute URLs matching window.location.origin and return as relative paths", () => {
    expect(sanitizeRedirect("http://localhost:3000/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirect("http://localhost:3000/settings?q=test")).toBe("/settings?q=test");
  });

  it("should allow absolute URLs matching VITE_TRUSTED_ORIGINS and return relative path", () => {
    expect(sanitizeRedirect("https://anotherapp.com/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirect("http://localhost:3001/welcome")).toBe("/welcome");
  });

  it("should reject untrusted absolute URLs", () => {
    expect(sanitizeRedirect("https://evil.com/dashboard")).toBe("/");
    expect(sanitizeRedirect("https://untrusted.com")).toBe("/");
  });

  it("should reject protocol-relative URLs", () => {
    expect(sanitizeRedirect("//evil.com")).toBe("/");
    expect(sanitizeRedirect("//anotherapp.com")).toBe("/");
    expect(sanitizeRedirect("///evil.com")).toBe("/");
  });

  it("should reject malicious javascript and data protocols", () => {
    expect(sanitizeRedirect("javascript:alert(1)")).toBe("/");
    expect(sanitizeRedirect("data:text/html,<script>alert(1)</script>")).toBe("/");
  });

  it("should reject complex bypass attempts (e.g. backslashes, @ symbol, subdomains)", () => {
    // Backslash bypasses
    expect(sanitizeRedirect("https:\\\\evil.com")).toBe("/");
    // Domain parameter pollution
    expect(sanitizeRedirect("https://anotherapp.com@evil.com/path")).toBe("/");
    // Subdomain similarity/spoofing
    expect(sanitizeRedirect("https://anotherapp.com.evil.com")).toBe("/");
    // Untrusted subdomains (since only exact domain is trusted)
    expect(sanitizeRedirect("https://sub.anotherapp.com/path")).toBe("/");
  });
});
