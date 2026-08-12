import { z } from "zod/v4";
import { zAdminQuery, zAdminMutation, zAuthenticatedQuery } from "./functions";

const releaseNoteType = z.enum(["feature", "fix", "improvement"]);

/** Creates a new release note, timestamped now. */
export const create = zAdminMutation({
  args: {
    type: releaseNoteType,
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const content = args.content.trim();

    if (!title) {
      throw new Error("Release note title is required.");
    }
    if (!content) {
      throw new Error("Release note content is required.");
    }

    return await ctx.db.insert("releaseNotes", {
      type: args.type,
      title,
      content,
      timestamp: Date.now(),
    });
  },
});

/** Lists all release notes, newest first. */
export const list = zAdminQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("releaseNotes")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();
  },
});

/**
 * Authenticated read used by the in-app changelog. Gated on session + student
 * profile (eligible users only). Newest first.
 */
export const listPublic = zAuthenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("releaseNotes")
      .withIndex("by_timestamp")
      .order("desc")
      .take(20);
  },
});
