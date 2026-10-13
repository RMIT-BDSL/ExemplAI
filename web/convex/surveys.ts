// The study session's surveys (convex/cohorts.ts), shared by the student pages,
// the Convex functions that validate answers and the admin export.
//
// Pre-survey (start of the session, about 3 minutes): prior experience and the
// covariates the analysis needs (ResearchMethodology.md §5.1): everyday AI use
// (the control group is a plain AI chat, so habitual chatbot users may do
// better there) and confidence before the exercises. Year and program aren't
// asked: a session's cohort is one class.
//
// Post-survey (end of the session, about 4 minutes): cognitive load (Paas
// 9-point scale; NASA-TLX Mental Demand and Frustration, §5.1), the
// pre-survey's confidence items again (pre/post change), perceptions of the
// tutor (from the approved survey question set, worded for both groups),
// interest in using it for the rest of the course, and two open questions for
// the thematic analysis (§7.2).
//
// Every question can be skipped, as the study information tells students;
// an unanswered question is simply missing from the answers.
//
// Question ids are the column names in the export: change wording freely, but
// keep an id once data has been collected under it.

export type SurveyQuestion =
  | { id: string; label: string; type: "choice"; options: readonly string[] }
  | { id: string; label: string; type: "multi"; options: readonly string[] }
  | {
      id: string;
      label: string;
      type: "scale";
      min: number;
      max: number;
      minLabel: string;
      maxLabel: string;
    }
  | { id: string; label: string; type: "text" | "long" };

export type SurveySection = { title: string; questions: readonly SurveyQuestion[] };

export type SurveyAnswers = Record<string, string | string[]>;

const AGREE = { type: "scale", min: 1, max: 5, minLabel: "Strongly disagree", maxLabel: "Strongly agree" } as const;
const CONFIDENT = { type: "scale", min: 1, max: 5, minLabel: "Not at all confident", maxLabel: "Very confident" } as const;

// Asked before and after, under the same ids with a pre_/post_ prefix.
const CONFIDENCE = [
  { id: "confidence_python", label: "How confident are you writing Python code?", ...CONFIDENT },
  {
    id: "confidence_branching",
    label: "How confident are you writing code that makes decisions with if, elif and else?",
    ...CONFIDENT,
  },
] as const;

const prefixed = (prefix: string) => CONFIDENCE.map((q) => ({ ...q, id: `${prefix}_${q.id}` }));

export const PRE_SURVEY: readonly SurveySection[] = [
  {
    title: "Your programming experience",
    questions: [
      { id: "english_comfort", label: "How comfortable are you learning programming in English?", type: "scale", min: 1, max: 5, minLabel: "Not comfortable", maxLabel: "Very comfortable" },
      {
        id: "prior_programming",
        label: "How much programming had you done before this course?",
        type: "choice",
        options: ["None", "Less than 3 months", "3 to 12 months", "More than a year"],
      },
      {
        id: "languages_used",
        label: "Which programming languages have you used before? Choose all that apply.",
        type: "multi",
        options: ["Python", "Java", "C or C++", "JavaScript", "Scratch or block-based", "Other", "None"],
      },
      ...prefixed("pre"),
    ],
  },
  {
    title: "AI tools",
    questions: [
      {
        id: "ai_use_frequency",
        label: "How often do you use AI tools (such as ChatGPT) when you program or study programming?",
        type: "choice",
        options: ["Never", "Less than once a week", "Once or twice a week", "Most days"],
      },
      {
        id: "ai_tools_used",
        label: "Which AI tools have you used? Choose all that apply.",
        type: "multi",
        options: ["ChatGPT", "GitHub Copilot", "Gemini", "DeepSeek", "Claude", "Other", "None"],
      },
      { id: "ai_helps_learning", label: "AI tools help me learn programming.", ...AGREE },
      { id: "ai_gives_answers", label: "When I use AI for programming, I usually ask it for the full solution.", ...AGREE },
      {
        id: "stuck_strategy",
        label: "What do you usually do when you get stuck on a programming exercise?",
        type: "long",
      },
    ],
  },
];

export const POST_SURVEY: readonly SurveySection[] = [
  {
    title: "The exercises",
    questions: [
      {
        id: "paas_mental_effort",
        label: "How much mental effort did you put into the exercises?",
        type: "scale",
        min: 1,
        max: 9,
        minLabel: "Very, very low",
        maxLabel: "Very, very high",
      },
      {
        id: "tlx_mental_demand",
        label: "How mentally demanding were the exercises?",
        type: "scale",
        min: 1,
        max: 10,
        minLabel: "Very low",
        maxLabel: "Very high",
      },
      {
        id: "tlx_frustration",
        label: "How insecure, discouraged, irritated, stressed or annoyed did you feel?",
        type: "scale",
        min: 1,
        max: 10,
        minLabel: "Very low",
        maxLabel: "Very high",
      },
      ...prefixed("post"),
    ],
  },
  {
    title: "The tutor",
    questions: [
      {
        id: "tutor_used",
        label: "How much did you use the tutor (the chat beside the exercise)?",
        type: "choice",
        options: ["Not at all", "Once or twice", "Several times", "On most exercises"],
      },
      {
        id: "tutor_clarity",
        label: "How clear were the tutor's explanations and guidance?",
        type: "scale",
        min: 1,
        max: 5,
        minLabel: "Very unclear",
        maxLabel: "Very clear",
      },
      { id: "tutor_helped_understand", label: "The tutor helped me understand the ideas behind the exercises.", ...AGREE },
      { id: "tutor_made_me_think", label: "The tutor made me think for myself instead of giving me the answer.", ...AGREE },
      {
        id: "use_rest_of_course",
        label: "Would you be interested in using the tutor for help for the rest of Python Programming Bootcamp?",
        type: "choice",
        options: ["Yes", "Maybe", "No"],
      },
    ],
  },
  {
    title: "In your own words",
    questions: [
      { id: "most_helpful", label: "What did you find most helpful, if anything?", type: "long" },
      {
        id: "challenges",
        label: "What was difficult or frustrating, and what would make the tutor better?",
        type: "long",
      },
    ],
  },
];

export const surveyQuestions = (survey: readonly SurveySection[]) => survey.flatMap((s) => s.questions);

/**
 * Checks answers against the survey and returns them cleaned (trimmed, long
 * text capped, unknown ids and skipped questions dropped). Any question may
 * be skipped; an answer that isn't one of the options or is off the scale is
 * refused.
 */
export function cleanAnswers(survey: readonly SurveySection[], answers: SurveyAnswers): SurveyAnswers {
  const clean: SurveyAnswers = {};
  for (const q of surveyQuestions(survey)) {
    const raw = answers[q.id];
    if (q.type === "multi") {
      const picked = (Array.isArray(raw) ? raw : []).filter((o) => q.options.includes(o));
      if (picked.length) clean[q.id] = [...new Set(picked)];
      continue;
    }
    const value = (typeof raw === "string" ? raw : "").trim();
    if (!value) continue;
    if (q.type === "choice" && !q.options.includes(value)) throw new Error(`Not a valid answer: ${q.label}`);
    if (q.type === "scale") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < q.min || n > q.max) throw new Error(`Not a valid answer: ${q.label}`);
    }
    clean[q.id] = value.slice(0, 2000);
  }
  return clean;
}
