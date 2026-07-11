import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  course: defineTable({
    course_name: v.string(),
    course_language: v.string(),
  }),
  // A "lesson". `detail`/`testCases` are optional so rows created before those
  // fields existed remain valid. `knowledge_component` keys BKT mastery.
  questions: defineTable({
    week: v.number(),
    course: v.id("course"),
    problem_name: v.string(),
    problem_description: v.string(),
    // Optional at the document level so pre-BKT rows remain valid; createLesson
    // still requires it via Zod.
    knowledge_component: v.optional(v.string()),
    topic: v.optional(v.string()),
    tag: v.optional(v.string()),
    detail: v.optional(v.string()),
    testCases: v.optional(
      v.array(
        v.object({
          input: v.string(),
          expectedOutput: v.string(),
          description: v.optional(v.string()),
          hidden: v.optional(v.boolean()),
        }),
      ),
    ),
    starter_code: v.optional(v.string()),
    solution_code: v.optional(v.string()),
  })
    .index("by_week", ["week"]) // week are fixed to 12 weeks
    .index("by_course", ["course"])
    .index("by_course_week", ["course", "week"])
    .index("by_kc", ["knowledge_component"]),
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    tokenIdentifier: v.optional(v.string()),
    role: v.optional(v.string()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),
  userProfiles: defineTable({
    userId: v.id("users"),
    tokenIdentifier: v.optional(v.string()),
    invitationCode: v.optional(v.string()),
  })
    .index("by_user_id", ["userId"])
    .index("by_token", ["tokenIdentifier"])
    .index("by_invitation_code", ["invitationCode"]),
  // Per-student progress on each lesson (a row in `questions`).
  // A lesson with no row here is treated as "pending" by the UI, so we only
  // store lessons a student has started ("in-progress") or finished
  // ("completed"). One row per (student, lesson) pair.
  // `has_run` / `bkt_recorded` are set only by the server after Judge0 runs.
  lessonProgress: defineTable({
    userId: v.id("users"),
    lessonId: v.id("questions"),
    status: v.union(v.literal("in-progress"), v.literal("completed")),
    has_run: v.optional(v.boolean()),
    bkt_recorded: v.optional(v.boolean()),
  })
    // "give me everything this student has worked on" (render their list)
    .index("by_user", ["userId"])
    // "who has worked on / completed this lesson" (admin stats)
    .index("by_lesson", ["lessonId"])
    // exact (student, lesson) lookup for fast upserts
    .index("by_user_lesson", ["userId", "lessonId"]),
  // Per-student BKT mastery for a knowledge component (shared across lessons
  // tagged with the same KC). Updated once per lesson on first Submit only.
  bktMastery: defineTable({
    userId: v.id("users"),
    knowledge_component: v.string(),
    prob_mastery: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_kc", ["userId", "knowledge_component"]),
  invitationCodes: defineTable({
    code: v.string(),
    isValid: v.boolean(),
    quantity: v.number(),
    usesCount: v.number(),
    createdBy: v.optional(v.string()),
    whoUsed: v.array(v.string()),
    expiryDate: v.optional(v.string()),
  }).index("by_code", ["code"]),
});
