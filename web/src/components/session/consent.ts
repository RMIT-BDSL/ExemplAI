// The participant information students read before agreeing to take part,
// adapted from the study's Participant Information and Consent Form (RMIT
// HREC project 29047) for the in-class session. DRAFT: the wording must match
// the approved form before a real session. Bump CONSENT_VERSION
// (convex/studentIds.ts) whenever it changes, so each consent records the
// text it was given against.

export const CONSENT_TITLE =
  "Enhancing Programming Education through Example-Based Learning and Generative AI Support";

export const CONSENT_SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "What is this study?",
    paragraphs: [
      "You are invited to take part in a research project run by Dr Phong Ngo and colleagues in the School of Science, Engineering and Technology, RMIT Vietnam. You have been invited because you are enrolled in this programming course.",
      "The project is developing and evaluating ExemplAI, an AI tutor that helps students learn programming through worked examples, examples with gaps to fill in, and examples with mistakes to find. Guardrails stop the tutor from giving away answers directly. The project is funded by RMIT.",
    ],
  },
  {
    heading: "What will I do today?",
    paragraphs: [
      "The session takes under an hour. You will answer a short survey about your background, work through this week's Python exercises in ExemplAI with help from its tutor, and answer a short survey about your experience at the end.",
      "Students are placed at random in one of two versions of the tutor, so we can compare them. Both versions help you with the same exercises.",
      "There are no costs, and you will not be paid.",
    ],
  },
  {
    heading: "Do I have to take part?",
    paragraphs: [
      "No. Taking part is voluntary. Whether you take part, decline or stop part-way will not affect your grades, your standing in the course, or your relationship with the researchers or RMIT.",
      "If you decline, you can still practise the exercises today. Nothing you do will be used in the research.",
      "You can skip any survey question you don't want to answer, and you can stop at any time.",
    ],
  },
  {
    heading: "What happens to my information?",
    paragraphs: [
      "We record your survey answers and your activity in ExemplAI (your code, your conversations with the tutor and how long you spend on each exercise) under your student ID, so that your surveys can be matched with your exercises.",
      "Before analysis, your student ID is replaced with a code. Only members of the research team can see the data. Results will be published in a way that does not identify you.",
      "Data is stored securely and kept for five years under the RMIT Research Data Management Policy, then destroyed. To withdraw your data, contact the researchers below.",
    ],
  },
  {
    heading: "Are there any risks?",
    paragraphs: [
      "Some questions or exercises may feel stressful. You can skip a question or stop at any time. If you feel upset or distressed, you can book an appointment with RMIT Counselling and Psychological Services at rmit.edu.vn/students/support/student-connect/book-an-appointment, call (028) 3622 4432, or drop in to Room 1.1.045 (Saigon South) or Room 1.1.208 (Hanoi), 9am to 4pm, Monday to Friday.",
      "Due to the statistical nature of large language models (LLMs), it may occasionally generate inaccurate, misleading, or incomplete information. To avoid this, you are encouraged to think critically and not treat the virtual tutor as a replacement for your instructors. If you are uncertain about the tutor's answers, you should seek clarification and discuss them with your instructors. This helps ensure accuracy while supporting deeper learning and independent problem-solving.",
    ],
  },
  {
    heading: "Who can I contact?",
    paragraphs: [
      "For questions about the project, contact Dr Phong Ngo (Principal Investigator), phong.ngo@rmit.edu.vn, or Hanh Nguyen (Research Assistant), hanh.nguyenmy@rmit.edu.vn.",
      "This project has been approved by the RMIT University Human Research Ethics Committee (project 29047). For concerns you don't wish to raise with the researchers, contact the HREC Secretary at humanethics@rmit.edu.au or +61 3 9925 1985.",
    ],
  },
];

export const CONSENT_STATEMENTS = [
  "I have read and understood the information above.",
  "I understand the purpose, procedures and risks of the research.",
  "I freely agree to take part, and I understand that I can stop at any time without affecting my relationship with RMIT.",
];
