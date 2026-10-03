import { convexTest } from "convex-test";
import { describe, it, expect, vi } from "vitest";
import { api, components, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import betterAuthSchema from "../convex/betterAuth/schema";
import {
  firstTryByBand,
  isFirstTry,
  isSubmitted,
  mean,
  modeForMastery,
  modeFromModel,
} from "../convex/studentMetrics";
import { triggers } from "../convex/triggers";

const modules = import.meta.glob(["../convex/**/*.ts", "!../convex/betterAuth/**"]);
const authModules = import.meta.glob("../convex/betterAuth/**/*.ts");
// recordCodeExecution / addSystemMessage only accept the backend secret.
process.env.CONVEX_BACKEND_SECRET = "secret";

const setup = () => {
  const t = convexTest(schema, modules);
  t.registerComponent("betterAuth", betterAuthSchema, authModules);
  return t;
};

// Pure unit tests for the admin student metrics.

describe("student metrics", () => {
  it("counts a lesson as submitted only after a Submit, and first-try only with no failures", () => {
    expect(isSubmitted({ status: "in-progress" })).toBe(false); // opened or Run only
    expect(isSubmitted({ status: "in-progress", failed_submits: 1 })).toBe(true);
    expect(isSubmitted({ status: "completed" })).toBe(true);

    expect(isFirstTry({ status: "completed", failed_submits: 0 })).toBe(true);
    expect(isFirstTry({ status: "completed" })).toBe(true);
    expect(isFirstTry({ status: "completed", failed_submits: 2 })).toBe(false);
    expect(isFirstTry({ status: "in-progress", failed_submits: 0 })).toBe(false);
  });

  it("maps mastery to the same example mode as the server orchestrator", () => {
    expect(modeForMastery(0)).toBe("complete");
    expect(modeForMastery(0.29)).toBe("complete");
    expect(modeForMastery(0.3)).toBe("faded");
    expect(modeForMastery(0.43)).toBe("faded");
    expect(modeForMastery(0.7)).toBe("faded");
    expect(modeForMastery(0.71)).toBe("erroneous");
  });

  it("reads the example mode from the tutor reply's recorded node", () => {
    expect(modeFromModel("faded_example_node")).toBe("faded");
    expect(modeFromModel("control_agent_node")).toBe("control");
    expect(modeFromModel("guardrail_blocked")).toBe("blocked");
    expect(modeFromModel(undefined)).toBeNull();
    expect(modeFromModel("new-model-test")).toBeNull();
  });

  it("computes a mean, null when empty", () => {
    expect(mean([])).toBeNull();
    expect(mean([0.2, 0.4])).toBeCloseTo(0.3);
  });

  it("groups first-try passes by mastery going into the lesson", () => {
    const bands = firstTryByBand([
      { status: "completed", failed_submits: 0, mastery_before: 0.15 }, // complete, first try
      { status: "completed", failed_submits: 2, mastery_before: 0.2 }, // complete, not first try
      { status: "in-progress", failed_submits: 1, mastery_before: 0.5 }, // faded, failing
      { status: "completed", failed_submits: 0, mastery_before: 0.9 }, // erroneous, first try
      { status: "completed", failed_submits: 0 }, // before mastery_before existed: skipped
      { status: "in-progress", mastery_before: 0.5 }, // opened, never submitted: skipped
    ]);
    expect(bands).toEqual([
      { band: "complete", lessons: 2, firstTry: 1 },
      { band: "faded", lessons: 1, firstTry: 0 },
      { band: "erroneous", lessons: 1, firstTry: 1 },
    ]);
  });
});

// Signs in a Better Auth user and mirrors them into `users` with a raw ctx,
// so (like accounts that predate the summaries) they have no studentStats yet.
async function signIn(t: ReturnType<typeof setup>, name: string, role: string) {
  const { userId, authId, sessionId } = await t.run(async (ctx) => {
    const authUser = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: { name, email: `${name}@rmit.edu.vn`, emailVerified: true, role, createdAt: Date.now(), updatedAt: Date.now() },
      },
    });
    const authId = authUser._id;
    const session = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: { userId: authId, expiresAt: Date.now() + 3600_000, token: `token-${authId}`, createdAt: Date.now(), updatedAt: Date.now() },
      },
    });
    const sessionId = session._id;
    const userId = await ctx.db.insert("users", { name, email: `${name}@rmit.edu.vn`, tokenIdentifier: authId, role });
    if (role !== "admin") {
      await ctx.db.insert("userProfiles", { userId, tokenIdentifier: authId, invitationCode: "TESTCODE" });
    }
    return { userId, authId, sessionId };
  });
  return { userId, as: t.withIdentity({ subject: authId, sessionId }) };
}

async function makeLessons(admin: Awaited<ReturnType<typeof signIn>>["as"], names: string[]) {
  const course = await admin.mutation(api.courses.createCourse, { course_name: "C", course_language: "python" });
  const ids = [];
  for (const problem_name of names) {
    ids.push(
      await admin.mutation(api.lessons.createLesson, {
        course,
        week: 1,
        problem_name,
        problem_description: "d",
        knowledge_component: "loops",
      }),
    );
  }
  return ids;
}

describe("student summaries", () => {
  it("keeps per-student, cohort and chat summaries in step with writes", async () => {
    const t = setup();
    const { as: admin } = await signIn(t, "admin", "admin");
    const [a, b] = await makeLessons(admin, ["A", "B"]);

    const { userId, as: student } = await signIn(t, "ana", "student");
    // Never starts a lesson; only a users write gives her a row.
    const { userId: benId } = await signIn(t, "ben", "student");
    await t.run((ctx) => triggers.wrapDB(ctx).db.patch(benId, { role: "student" }));
    await t.run((ctx) => triggers.wrapDB(ctx).db.patch(benId, { role: undefined }));

    await student.mutation(api.examples.openLesson, { lessonId: a });
    await student.mutation(api.courses.setLessonStatus, { lessonId: a, status: "in-progress" });
    // Fails, then passes: submitted, not first try. Mastery going in was 0.2.
    await student.mutation(api.courses.recordCodeExecution, {
      backendSecret: "secret",
      lessonId: a,
      passed: false,
      actionType: "submit",
      probMastery: 0.4,
      priorMastery: 0.2,
      knowledgeComponent: "loops",
    });
    await student.mutation(api.courses.recordCodeExecution, { lessonId: a, passed: true, actionType: "submit", backendSecret: "secret" });
    // First-try pass with mastery 0.4 going in.
    await student.mutation(api.courses.recordCodeExecution, {
      backendSecret: "secret",
      lessonId: b,
      passed: true,
      actionType: "submit",
      probMastery: 0.98,
      priorMastery: 0.4,
      knowledgeComponent: "loops",
      mastered: true,
    });

    const chatId = await student.mutation(api.chats.getOrCreateChat, { lessonId: a });
    await student.mutation(api.chats.addMessage, { chatId, sender: "user", content: "help", trigger: "get_help" });
    await student.mutation(api.chats.addSystemMessage, {
      chatId,
      sender: "assistant",
      content: "example",
      model: "complete_example_node",
      responseType: "new_example",
      backendSecret: "secret",
    });

    const summary = await admin.query(api.students.studentSummary, {});
    expect(summary).toMatchObject({
      students: 2,
      active: 1,
      activeThisWeek: 1,
      submitted: 2,
      firstTry: 1,
      firstTryRate: 0.5,
      topicsMastered: 1,
      firstTryByBand: [
        { band: "complete", lessons: 1, firstTry: 0 },
        { band: "faded", lessons: 1, firstTry: 1 },
        { band: "erroneous", lessons: 0, firstTry: 0 },
      ],
    });

    const first = await admin.query(api.students.listStudents, { paginationOpts: { numItems: 1, cursor: null } });
    expect(first.isDone).toBe(false);
    expect(first.page).toHaveLength(1);
    const ana = first.page[0];
    expect(ana).toMatchObject({ userId, name: "ana", started: 2, submitted: 2, firstTry: 1, completed: 2, topicsMastered: 1 });
    expect(ana.overallMastery).toBeCloseTo(0.98);
    expect(ana.current).toMatchObject({
      lessonId: a,
      status: "completed",
      examples: { used: 1, cap: 3, remaining: 0 },
      lastReply: { mode: "complete", responseType: "new_example" },
    });
    const rest = await admin.query(api.students.listStudents, { paginationOpts: { numItems: 10, cursor: first.continueCursor } });
    expect(rest.page.map((s) => s.name)).toEqual(["ben"]);

    const detail = await admin.query(api.students.getStudent, { userId });
    expect(detail!.totals.examplesGiven).toBe(1);
    expect(
      detail!.activity
        .filter((e) => e.kind === "help" || e.kind === "example")
        .map((e) => e.kind)
        .sort(),
    ).toEqual(["example", "help"]);

    // Making a student staff takes them out of the cohort.
    await t.run((ctx) => triggers.wrapDB(ctx).db.patch(userId, { role: "management" }));
    expect(await admin.query(api.students.studentSummary, {})).toMatchObject({ students: 1, active: 0, submitted: 0 });
  });

  it("only records code execution results sent with the backend secret", async () => {
    const t = setup();
    const { as: admin } = await signIn(t, "admin", "admin");
    const [lessonId] = await makeLessons(admin, ["A"]);
    const { userId, as: student } = await signIn(t, "ana", "student");

    // A student calling directly with their own session can't forge a pass.
    for (const backendSecret of ["", "guess"]) {
      await expect(
        student.mutation(api.courses.recordCodeExecution, {
          lessonId,
          passed: true,
          actionType: "submit",
          probMastery: 1,
          priorMastery: 0.9,
          knowledgeComponent: "loops",
          mastered: true,
          backendSecret,
        }),
      ).rejects.toThrow(/backend secret/);
    }
    const written = await t.run(async (ctx) => ({
      progress: await ctx.db.query("lessonProgress").collect(),
      mastery: await ctx.db.query("bktMastery").collect(),
    }));
    expect(written).toEqual({ progress: [], mastery: [] });

    await student.mutation(api.courses.recordCodeExecution, { lessonId, passed: true, actionType: "submit", backendSecret: "secret" });
    const progress = await t.run((ctx) => ctx.db.query("lessonProgress").collect());
    expect(progress).toMatchObject([{ userId, lessonId, status: "completed" }]);
  });

  it("lets a student only mark a lesson in progress, never complete or clear it", async () => {
    const t = setup();
    const { as: admin } = await signIn(t, "admin", "admin");
    const [lessonId] = await makeLessons(admin, ["A"]);
    const { as: student } = await signIn(t, "ana", "student");

    await student.mutation(api.courses.setLessonStatus, { lessonId, status: "in-progress" });
    await student.mutation(api.courses.recordCodeExecution, { lessonId, passed: false, actionType: "submit", backendSecret: "secret" });
    for (const status of ["completed", "pending"]) {
      await expect(
        // Bypasses the client types, as a hand-crafted call would.
        student.mutation(api.courses.setLessonStatus, { lessonId, status } as never),
      ).rejects.toThrow();
    }
    // The failed Submit survives, so a later pass can't count as first try.
    expect(await t.run((ctx) => ctx.db.query("lessonProgress").collect())).toMatchObject([
      { status: "in-progress", failed_submits: 1 },
    ]);
  });

  it("backfills summaries for data written without triggers", async () => {
    vi.useFakeTimers();
    const t = setup();
    const { as: admin } = await signIn(t, "admin", "admin");
    const [lessonId] = await makeLessons(admin, ["A"]);
    const { userId } = await signIn(t, "ana", "student");
    // Raw writes, as if they happened before the summaries existed.
    const chatId = await t.run(async (ctx) => {
      await ctx.db.insert("lessonProgress", { userId, lessonId, status: "completed", failed_submits: 0, mastery_before: 0.8 });
      await ctx.db.insert("bktMastery", { userId, knowledge_component: "loops", prob_mastery: 0.9, updatedAt: Date.now() });
      const chatId = await ctx.db.insert("chats", { userId, lessonId });
      await ctx.db.insert("chatMessages", { chatId, sender: "assistant", content: "x", response_type: "new_example" });
      return chatId;
    });

    await t.mutation(internal.students.backfillSummaries, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();

    expect(await admin.query(api.students.studentSummary, {})).toMatchObject({
      students: 1,
      active: 1,
      submitted: 1,
      firstTry: 1,
      firstTryByBand: [
        { band: "complete", lessons: 0, firstTry: 0 },
        { band: "faded", lessons: 0, firstTry: 0 },
        { band: "erroneous", lessons: 1, firstTry: 1 },
      ],
    });
    expect(await t.run((ctx) => ctx.db.get(chatId))).toMatchObject({ message_count: 1, examples_given: 1 });
    const events = await t.run((ctx) => ctx.db.query("chatEvents").collect());
    expect(events.map((e) => e.kind)).toEqual(["example"]);
  });
});
