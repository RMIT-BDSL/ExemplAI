import { describe, it, expect } from "vitest";
import type { Doc } from "../convex/_generated/dataModel";
import { forStudent } from "../convex/chats";

describe("rejected drafts", () => {
  it("never reach the student", () => {
    const message = {
      _id: "m1",
      _creationTime: 1,
      chatId: "c1",
      sender: "assistant",
      content: "Here's a different example.",
      dean_decision: "approved_after_retry",
      rejected_drafts: [{ content: "return 'Hello World!'", reason: "DIRECT_ANSWER_LEAK" }],
    } as unknown as Doc<"chatMessages">;

    const shown = forStudent(message);
    expect(shown).not.toHaveProperty("rejected_drafts");
    expect(JSON.stringify(shown)).not.toContain("Hello World");
    expect(shown.content).toBe("Here's a different example.");
  });
});
