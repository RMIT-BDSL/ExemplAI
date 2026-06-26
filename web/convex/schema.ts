import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  course: defineTable({
    course_name: v.string(),
    course_language: v.string(),
  }),
  questions: defineTable({
    week: v.number(),
    course: v.id("course"),
    problem_name: v.string(),
    problem_description: v.string(),
    // todo implement solution (not for now)
  }).index("by_week", ["week"]), // week are fixed to 12 weeks
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
