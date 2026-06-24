import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    tokenIdentifier: v.optional(v.string()),
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
});
