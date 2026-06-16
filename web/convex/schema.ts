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
  //   users: defineTable({
  //     name: v.string(),
  //     tokenIdentifier: v.string(),
  //   }).index("by_token", ["tokenIdentifier"]),
});
