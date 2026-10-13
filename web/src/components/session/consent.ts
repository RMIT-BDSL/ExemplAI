// The Participant Information Sheet students read before agreeing to take
// part, word for word from "Participant-Info-v2-Oct-13.docx" (Ethics/
// Supporting documents), with only the double full stop at the end of section
// 1 tidied. Keep it in step with that document, and bump CONSENT_VERSION
// (convex/studentIds.ts) whenever it changes, so each consent records the text
// it was given against.

export const CONSENT_TITLE =
  "Learning from Examples: Unlock the Power of Generative AI for Teaching and Learning Programming";

export const CONSENT_PEOPLE: { role: string; names: string }[] = [
  { role: "Principal Investigator", names: "Jeff Nijsse" },
  {
    role: "Associate Investigator(s)",
    names: "Joshua Dwight, Nick McIntosh, Tri Dang, Tri Huynh, Anh Hoang",
  },
  { role: "Research Assistant", names: "Hanh Nguyen" },
];

export type ConsentSection = { heading: string; paragraphs: string[] };

export const CONSENT_PARTS: { title: string; sections: ConsentSection[] }[] = [
  {
    title: "What does my participation involve?",
    sections: [
      {
        heading: "1. Introduction",
        paragraphs: [
          "You are invited to take part in this research project, which is called Learning from Examples: Unlock the Power of Generative AI for Teaching and Learning Programming. You have been invited because you have enrolled in a programming course.",
          "This Participant Information Sheet tells you about the research project. It explains the processes involved with taking part. Knowing what is involved will help you decide if you want to take part in the research.",
          "Please read this information carefully. Ask questions about anything that you don’t understand or want to know more about. Participation in this research is voluntary. If you don’t wish to take part, you don’t have to.",
          "If you decide you want to take part in the research project, you may continue to the survey after reading this Participant Information Sheet. By completing the survey you are telling us that you:",
          "• Understand what you have read\n• Consent to take part in the research project",
          "You may download a copy of this Participant Information Sheet to keep.",
        ],
      },
      {
        heading: "2. What is the purpose of this research?",
        paragraphs: [
          "The purpose of the study is to develop and evaluate an AI-powered virtual tutor grounded in a problem-solving and example-driven pedagogical approach, supporting students in learning programming more effectively. The research findings will provide insights into how AI assistants can be integrated into programming education in a way that enhances learning while encouraging students to think critically and avoid over-dependence on automated tools.",
        ],
      },
      {
        heading: "3. What does participation in this research involve?",
        paragraphs: [
          "If you decide to take part in the research project, you will be asked to access and use the AI-powered virtual tutor while learning programming concepts. At the end of the session, you will be invited to participate in a survey to provide feedback on your experiences with the tutor.",
          "The session will take about 55 minutes.",
          "There are no costs associated with participating in this research project, nor will you be paid.",
        ],
      },
      {
        heading: "4. Other relevant information about the research project",
        paragraphs: [
          "This research involves undergraduate students who are taking programming courses such as C/C++, Java, Python at RMIT Vietnam.",
        ],
      },
      {
        heading: "5. Do I have to take part in this research project?",
        paragraphs: [
          "Participation in any research project is voluntary. If you do not wish to take part, you do not have to. If you decide to take part and later change your mind, you are free to withdraw from the project at any stage. If you do not finish, your partially complete data and responses will be deleted.",
          "If you do decide to take part, you may download this Participant Information Form to keep.",
          "Your decision whether to take part or not to take part, or to take part and then withdraw, will not affect your relationship with the researchers or with RMIT University.",
          "Submitting your completed survey is an indication of your consent to participate in the study.",
        ],
      },
      {
        heading: "6. What are the possible benefits of taking part?",
        paragraphs: [
          "Should you consent to participate, you will not receive any financial benefits; however, you may appreciate contributing to knowledge. Possible benefits may include gaining access to an additional AI learning support tool that helps you practice programming concepts more independently and confidently. Being part of a study that will provide insights into how AI assistants can be integrated into programming education in a way that enhances learning while encouraging students to think critically and avoid over-dependence on automated tools.",
        ],
      },
      {
        heading: "7. What are the risks and disadvantages of taking part?",
        paragraphs: [
          "Psychological distress",
          "You may feel that some of the questions we ask are stressful or upsetting. If you do not wish to answer a question, you may skip it and go to the next question, or you may stop immediately. If you become upset or distressed because of your participation in the research project, you can seek help from RMIT Counselling and Psychological Services by booking a counselling appointment online through the Student Connect Portal (log in with your RMIT account).",
          "Online surveys",
          "This project will use an external site to create, collect and analyse data collected in a survey format. The site we are using is Convex. If you agree to participate in this survey, the responses you provide will be stored on their host server. Your survey ID is recorded with your responses; no other personal information is collected. After the session the ID is deidentified. Once we have completed our analysis, we will import the data to RMIT’s server where it will be stored securely for five years. The data on the host server will then be deleted.",
        ],
      },
      {
        heading: "8. What if I withdraw from this research project?",
        paragraphs: [
          "If you do consent to participate, you may withdraw at any time. If you withdraw part-way through a research project, data collected to that point will be removed from the study.",
        ],
      },
      {
        heading: "9. What happens when the research project ends?",
        paragraphs: [
          "You will be able to request a copy of the summary findings of the project once the research has been completed, and the results have been analysed, which is expected to be in June 2027.",
        ],
      },
    ],
  },
  {
    title: "How is the research project being conducted?",
    sections: [
      {
        heading: "10. What will happen to information about me?",
        paragraphs: [
          "By continuing on to the survey, you are consenting to the research team collecting and using information from you for the research project. Your survey ID is recorded with your responses; no other personal information is collected. After the session the ID is deidentified.",
          "After the experiment, all data will be stored securely on RMIT servers, accessible only to members of the research team. The data will be retained for 5 years in accordance with the RMIT Research Data Management Policy. After this retention period, the data will be deleted.",
          "It is anticipated that the results of this research project will be published and/or presented in a variety of forums. In any publication and/or presentation, information will be provided in such a way that you cannot be identified.",
        ],
      },
      {
        heading: "11. Who is organising and funding the research?",
        paragraphs: [
          "This research project is being conducted by Jeff Nijsse and colleagues at the School of Science, Engineering & Technology. It is funded by RMIT.",
        ],
      },
      {
        heading: "12. Who has reviewed the research project?",
        paragraphs: [
          "All research in Australia involving humans is reviewed by an independent group of people called a Human Research Ethics Committee (HREC). This research project has been approved by the RMIT University HREC.",
          "This project will be carried out according to the National Statement on Ethical Conduct in Human Research (2023). This statement has been developed to protect the interests of people who agree to participate in human research studies.",
        ],
      },
      {
        heading: "13. Further information and who to contact",
        paragraphs: [
          "If you want any further information concerning this project, you can contact the researcher:",
          "Research contact person\nName: Jeff Nijsse\nPosition: Principal investigator\nEmail: Jeff.nijsse@rmit.edu.vn",
          "Or",
          "Name: Hanh Nguyen\nPosition: Research Assistant\nEmail/Teams: hanh.nguyenmy@rmit.edu.vn",
        ],
      },
      {
        heading: "14. Complaints",
        paragraphs: [
          "Should you have any concerns or questions about this research project, which you do not wish to discuss with the researchers listed in this document, then you may contact:",
          "Reviewing HREC name: RMIT University\nHREC Secretary: Pascal Bernard\nTelephone: +613 9925 1985\nEmail: humanethics@rmit.edu.au\nMailing address: Manager, Research Governance and Ethics, RMIT University, GPO Box 2476, MELBOURNE VIC 3001",
        ],
      },
    ],
  },
];

export const CONSENT_ACKNOWLEDGEMENT =
  "Acknowledgement by Participant – by continuing on to the survey:";

export const CONSENT_STATEMENTS = [
  "I have read and understood the Participant Information Sheet.",
  "I understand the purposes, procedures and risks of the research described in the project.",
  "I have had an opportunity to ask questions and I am satisfied with the answers I have received.",
  "I freely agree to participate in this research project as described and understand that I am free to withdraw at any time during the project without affecting my relationship with RMIT.",
  "I understand that I can download a copy of this document to keep.",
];

/** The sheet as plain text, for the "Download a copy" button. */
export function consentText(): string {
  const lines = ["Participant Information Sheet", "", CONSENT_TITLE, ""];
  for (const p of CONSENT_PEOPLE) lines.push(`${p.role}: ${p.names}`);
  for (const part of CONSENT_PARTS) {
    lines.push("", part.title.toUpperCase());
    for (const s of part.sections) {
      lines.push("", s.heading, ...s.paragraphs.flatMap((p) => ["", p]));
    }
  }
  lines.push(
    "",
    CONSENT_ACKNOWLEDGEMENT,
    ...CONSENT_STATEMENTS.map((s) => `- ${s}`),
    "",
  );
  return lines.join("\n");
}
