import type * as React from "react";

/**
 * Full-page frame for the study session's screens (consent, surveys,
 * completion): the workspace look, a reading-width column, a step label.
 */
export function SessionPage({
  step,
  title,
  intro,
  children,
}: {
  step?: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="xa-workspace min-h-dvh w-full px-4 py-10 sm:px-6">
      <main className="mx-auto w-full max-w-2xl">
        <p className="mb-6 text-[13px] font-semibold tracking-tight text-ink">
          ExemplAI
        </p>
        <header className="mb-8 border-b border-rule-strong pb-6">
          {step && (
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
              {step}
            </p>
          )}
          <h1 className="font-serif text-[1.6rem] font-medium leading-tight tracking-[-0.02em] text-ink text-balance">
            {title}
          </h1>
          {intro && (
            <div className="mt-2 font-serif text-[0.95rem] leading-[1.75] text-ink-prose">
              {intro}
            </div>
          )}
        </header>
        {children}
      </main>
    </div>
  );
}

/** The flow's steps, for the step label ("Step 2 of 4 · Background"). */
export const STEPS = [
  "Consent",
  "Before you start",
  "Exercises",
  "Feedback",
] as const;
export const stepLabel = (i: number) =>
  `Step ${i + 1} of ${STEPS.length} · ${STEPS[i]}`;
