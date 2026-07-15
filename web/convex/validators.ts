import { z } from "zod/v4";
import { zid } from "convex-helpers/server/zod4";

/**
 * Shared Zod validators for courses and lessons.
 *
 * These are the single source of truth: the database schema (see `schema.ts`)
 * is derived from them via `zodToConvexFields`, and the CRUD functions reuse
 * them to validate arguments at runtime (length checks, week range, etc.).
 *
 * NOTE: a "lesson" is stored in the `questions` table — that table models
 * lessons, and `lessonProgress` references its rows as `lessonId`.
 */

/** A single auto-grader test case for a lesson. */
export const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  // Human-readable label, e.g. "handles empty input".
  description: z.string().optional(),
  // Hidden tests run during grading but aren't shown to students as samples.
  hidden: z.boolean().optional(),
});
export type TestCase = z.infer<typeof testCaseSchema>;

/** Fields of the `course` table. */
export const courseFields = {
  course_name: z.string().min(1, "Course name is required"),
  course_language: z.string().min(1, "Course language is required"),
};

/** Fields of the `questions` table (a lesson). */
export const lessonFields = {
  course: zid("course"),
  // Lessons are bucketed into a fixed 12-week program.
  week: z.number().int().min(1).max(12),
  problem_name: z.string().min(1, "Problem name is required"),
  problem_description: z.string(),
  // Skill key for BKT (e.g. "loops", "io_basics").
  knowledge_component: z.string().min(1, "Knowledge component is required"),
  // Human-readable KC label (e.g. "Loops").
  topic: z.string().optional(),
  // Dataset / cohort label (e.g. "csedm", "csedm2").
  tag: z.string().optional(),
  // Long-form lesson content / instructions.
  detail: z.string().optional(),
  testCases: z.array(testCaseSchema).optional(),
  starter_code: z.string().optional(),
  solution_code: z.string().optional(),
};
