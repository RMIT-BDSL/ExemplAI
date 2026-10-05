import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { countFields as counts, replyCountFields } from "./studentMetrics";

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
    // Last lesson the student opened; returning to a lesson from a different
    // one resets that lesson's used-up example allowance (convex/examples.ts).
    last_opened_lesson: v.optional(v.id("questions")),
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
    // Failed Submits on this lesson; the first unlocks "Get help" in the chat.
    failed_submits: v.optional(v.number()),
    // Server-built summary of the last failed Submit, passed to the tutor
    // (hidden tests are counted, never detailed).
    last_error_trace: v.optional(v.string()),
    // Example round (convex/examples.ts): examples given after round_started_at
    // count against the cap; round_failed_submits earns them. Reset together.
    round_started_at: v.optional(v.number()),
    round_failed_submits: v.optional(v.number()),
    // Activity timestamps for the admin student view (convex/students.ts).
    // Rows from before these existed fall back to _creationTime.
    updated_at: v.optional(v.number()),
    last_submit_at: v.optional(v.number()),
    completed_at: v.optional(v.number()),
    // KC mastery just before this lesson's first graded Submit (BKT prior when
    // the student had none), so admins can relate mastery to first-try passes
    // without the circularity of the post-update value.
    mastery_before: v.optional(v.number()),
  })
    // "give me everything this student has worked on" (render their list)
    .index("by_user", ["userId"])
    // "who has worked on / completed this lesson" (admin stats)
    .index("by_lesson", ["lessonId"])
    // exact (student, lesson) lookup for fast upserts
    .index("by_user_lesson", ["userId", "lessonId"]),
  // Per-student BKT mastery for a knowledge component (shared across lessons
  // tagged with the same KC). Updated once per lesson on first Submit only.
  // `mastered` is sticky: set the first time prob_mastery reaches the mastery
  // threshold (server/bkt.py MASTERY_THRESHOLD) and never cleared, so a student
  // cleared to the next topic stays cleared.
  bktMastery: defineTable({
    userId: v.id("users"),
    knowledge_component: v.string(),
    prob_mastery: v.number(),
    updatedAt: v.number(),
    mastered: v.optional(v.boolean()),
    masteredAt: v.optional(v.number()),
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
  chats: defineTable({
    userId: v.id("users"),
    lessonId: v.id("questions"),
    // Summary of chatMessages, kept up to date by convex/triggers.ts so the
    // admin views never read a whole conversation. Missing on chats that
    // predate it until students:backfillSummaries runs.
    message_count: v.optional(v.number()),
    last_message_at: v.optional(v.number()),
    last_reply_at: v.optional(v.number()),
    last_reply_model: v.optional(v.string()),
    last_reply_response_type: v.optional(v.string()),
    examples_given: v.optional(v.number()),
    // Tutor replies by who wrote them (studentMetrics ReplyKind).
    reply_counts: v.optional(replyCountFields),
  }).index("by_user_lesson", ["userId", "lessonId"]),
  // One row per student: their counters and last activity, maintained by
  // convex/triggers.ts. The admin student list pages through this.
  studentStats: defineTable({
    userId: v.id("users"),
    lastActivityAt: v.number(),
    ...counts,
  })
    .index("by_user", ["userId"])
    .index("by_last_activity", ["lastActivityAt"]),
  // Single row: totals over every student, maintained alongside studentStats.
  cohortStats: defineTable({
    students: v.number(),
    // Students with at least one lessonProgress row.
    active: v.number(),
    ...counts,
  }),
  // Help requests and examples given, copied from chatMessages without the
  // content so a student's timeline is a small indexed read.
  chatEvents: defineTable({
    userId: v.id("users"),
    chatId: v.id("chats"),
    lessonId: v.id("questions"),
    messageId: v.id("chatMessages"),
    at: v.number(),
    kind: v.union(v.literal("help"), v.literal("example")),
    detail: v.optional(v.string()),
  })
    .index("by_user_at", ["userId", "at"])
    .index("by_chat", ["chatId"]),
  releaseNotes: defineTable({
    type: v.union(
      v.literal("feature"),
      v.literal("fix"),
      v.literal("improvement"),
    ),
    timestamp: v.number(),
    title: v.string(),
    content: v.string(),
  }).index("by_timestamp", ["timestamp"]),
  chatMessages: defineTable({
    chatId: v.id("chats"),
    sender: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    sentBySystem: v.optional(v.boolean()),
    model: v.optional(v.string()),
    // Student turns created by the Get help / New example buttons rather than typed.
    trigger: v.optional(v.union(v.literal("get_help"), v.literal("new_example"))),
    // Tutor turns: what the reply delivered. Only "new_example" counts against
    // the example allowance; a Dean-rejected draft is saved as "fallback".
    response_type: v.optional(
      v.union(v.literal("new_example"), v.literal("follow_up"), v.literal("fallback"))
    ),
    // Tutor turns: the Dean's decision (approved / approved_after_retry /
    // rejected / limit) and the check that fired, for analysis and testing.
    dean_decision: v.optional(v.string()),
    dean_reason: v.optional(v.string()),
  })
    .index("by_chat", ["chatId"])
    // Examples given this round: a bounded range read instead of the whole chat.
    .index("by_chat_response", ["chatId", "response_type"]),
});
