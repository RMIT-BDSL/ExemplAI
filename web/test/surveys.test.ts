import { describe, expect, it } from "vitest";
import { cleanAnswers, POST_SURVEY, PRE_SURVEY, type SurveyAnswers, surveyQuestions } from "../convex/surveys";

/** A full set of valid answers: the first option, the lowest scale point, no text. */
function minimal(survey: typeof PRE_SURVEY): SurveyAnswers {
  const a: SurveyAnswers = {};
  for (const q of surveyQuestions(survey)) {
    if (q.type === "choice") a[q.id] = q.options[0];
    else if (q.type === "multi") a[q.id] = [q.options[0]];
    else if (q.type === "scale") a[q.id] = String(q.min);
  }
  return a;
}

describe("surveys", () => {
  it("has unique question ids across both surveys", () => {
    const ids = [...surveyQuestions(PRE_SURVEY), ...surveyQuestions(POST_SURVEY)].map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("accepts a complete set of answers and leaves out skipped optional text", () => {
    const clean = cleanAnswers(PRE_SURVEY, minimal(PRE_SURVEY));
    expect(clean.ai_use_frequency).toBe("Never");
    expect(clean.stuck_strategy).toBeUndefined();
  });

  it("rejects a missing required answer", () => {
    const a = minimal(PRE_SURVEY);
    delete a.ai_use_frequency;
    expect(() => cleanAnswers(PRE_SURVEY, a)).toThrow(/How often do you use AI/);
  });

  it("rejects an answer that isn't an option or is off the scale", () => {
    expect(() => cleanAnswers(PRE_SURVEY, { ...minimal(PRE_SURVEY), ai_use_frequency: "Hourly" })).toThrow();
    expect(() => cleanAnswers(POST_SURVEY, { ...minimal(POST_SURVEY), paas_mental_effort: "10" })).toThrow();
  });

  it("keeps only known options in a multi-choice answer, without duplicates", () => {
    const clean = cleanAnswers(PRE_SURVEY, { ...minimal(PRE_SURVEY), languages_used: ["Java", "Java", "Rust"] });
    expect(clean.languages_used).toEqual(["Java"]);
  });

  it("trims text, caps its length and drops unknown ids", () => {
    const clean = cleanAnswers(POST_SURVEY, {
      ...minimal(POST_SURVEY),
      challenges: `  ${"x".repeat(3000)}  `,
      not_a_question: "hi",
    });
    expect((clean.challenges as string).length).toBe(2000);
    expect(clean.not_a_question).toBeUndefined();
  });
});
