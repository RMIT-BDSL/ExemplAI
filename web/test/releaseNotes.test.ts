import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const setup = () => convexTest(schema, modules);

describe("releaseNotes schema", () => {
  it("creates a release note and reads it back", async () => {
    const t = setup();
    const id = await t.run(async (ctx) =>
      ctx.db.insert("releaseNotes", {
        type: "feature",
        timestamp: 1712345678901,
        title: "Dark mode",
        content: "Users can now toggle dark mode.",
      })
    );

    const note = await t.run(async (ctx) => ctx.db.get(id));
    expect(note).toMatchObject({
      _id: id,
      type: "feature",
      timestamp: 1712345678901,
      title: "Dark mode",
      content: "Users can now toggle dark mode.",
    });
  });

  it("indexes release notes by timestamp and orders them newest first", async () => {
    const t = setup();
    await t.run(async (ctx) =>
      ctx.db.insert("releaseNotes", {
        type: "fix",
        timestamp: 1000,
        title: "First",
        content: "Old note",
      })
    );
    await t.run(async (ctx) =>
      ctx.db.insert("releaseNotes", {
        type: "improvement",
        timestamp: 3000,
        title: "Third",
        content: "Newest note",
      })
    );
    await t.run(async (ctx) =>
      ctx.db.insert("releaseNotes", {
        type: "feature",
        timestamp: 2000,
        title: "Second",
        content: "Middle note",
      })
    );

    const notes = await t.run(async (ctx) =>
      ctx.db.query("releaseNotes").withIndex("by_timestamp").order("desc").collect()
    );
    expect(notes.map((n) => n.title)).toEqual(["Third", "Second", "First"]);
  });

  it("rejects an invalid release type", async () => {
    const t = setup();
    await expect(
      t.run(async (ctx) =>
        ctx.db.insert("releaseNotes", {
          // @ts-expect-error invalid literal for the type union
          type: "breaking",
          timestamp: 1,
          title: "Bad",
          content: "Nope",
        })
      )
    ).rejects.toThrow();
  });
});
