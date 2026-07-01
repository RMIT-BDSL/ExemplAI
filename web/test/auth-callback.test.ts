import { describe, it, expect } from "vitest";
import {
  // appendQueryParam,
  // buildMagicLinkCallback,
  stripSearchParams,
} from "../src/lib/auth-callback";

/*
describe("appendQueryParam", () => {
  it("uses ? for a path with no query string", () => {
    expect(appendQueryParam("/dashboard", "magic", "1")).toBe(
      "/dashboard?magic=1",
    );
  });

  it("uses & for a path that already has a query string", () => {
    expect(appendQueryParam("/dashboard?tab=1", "magic", "1")).toBe(
      "/dashboard?tab=1&magic=1",
    );
  });

  it("url-encodes the value", () => {
    expect(appendQueryParam("/x", "code", "a b/c")).toBe("/x?code=a%20b%2Fc");
  });
});

describe("buildMagicLinkCallback", () => {
  it("tags a bare redirect with magic=1", () => {
    expect(buildMagicLinkCallback("/")).toBe("/?magic=1");
    expect(buildMagicLinkCallback("/course/123")).toBe("/course/123?magic=1");
  });

  it("defaults to / when no redirect is given", () => {
    expect(buildMagicLinkCallback(undefined)).toBe("/?magic=1");
  });

  it("appends magic=1 with & when the redirect already has a query", () => {
    expect(buildMagicLinkCallback("/dashboard?user=42")).toBe(
      "/dashboard?user=42&magic=1",
    );
  });

  it("carries an invitation code before the magic marker (new-user flow)", () => {
    expect(buildMagicLinkCallback("/", { code: "INVITE123" })).toBe(
      "/?code=INVITE123&magic=1",
    );
  });

  it("encodes the invitation code and chains separators correctly", () => {
    expect(buildMagicLinkCallback("/welcome?ref=x", { code: "a/b c" })).toBe(
      "/welcome?ref=x&code=a%2Fb%20c&magic=1",
    );
  });
});
*/

describe("stripSearchParams", () => {
  it("removes the magic marker so a refresh won't re-fire", () => {
    expect(stripSearchParams({ magic: true, tab: "1" }, ["magic"])).toEqual({
      tab: "1",
    });
  });

  it("removes multiple keys (code + magic) at once", () => {
    expect(
      stripSearchParams({ code: "X", magic: true, page: "2" }, [
        "code",
        "magic",
      ]),
    ).toEqual({ page: "2" });
  });

  it("is a no-op when keys are absent", () => {
    expect(stripSearchParams({ tab: "1" }, ["magic"])).toEqual({ tab: "1" });
  });

  it("does not mutate the input object", () => {
    const input = { magic: true, tab: "1" };
    stripSearchParams(input, ["magic"]);
    expect(input).toEqual({ magic: true, tab: "1" });
  });
});
