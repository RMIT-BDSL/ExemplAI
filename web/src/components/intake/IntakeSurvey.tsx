import { useMutation } from "convex/react";
import { AlertCircle, ArrowRight } from "lucide-react";
import * as React from "react";
import { AuthButton } from "#/components/auth/AuthButton";
import { AuthCard } from "#/components/auth/AuthCard";
import { cn } from "#/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { INTAKE_QUESTIONS } from "../../../convex/studentIds";

type Question = (typeof INTAKE_QUESTIONS)[number];

/** The short intake survey a cohort participant answers on first sign-in. */
export function IntakeSurvey({
  questions,
}: {
  questions: readonly Question[];
}) {
  const submit = useMutation(api.cohorts.submitIntake);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const missing = questions.filter(
    (q) => q.type === "choice" && !answers[q.id],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missing.length) {
      setError("Please answer each question with options.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await submit({ answers });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save your answers. Please try again.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="xa-workspace flex min-h-dvh w-full items-center justify-center px-4 py-10">
      <AuthCard
        title="Before you start"
        subtitle="A few quick questions about your programming background."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          {questions.map((q) => (
            <fieldset key={q.id} className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-ink">
                {q.label}
              </legend>
              {q.type === "choice" ? (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={answers[q.id] === option}
                      onClick={() =>
                        setAnswers((a) => ({ ...a, [q.id]: option }))
                      }
                      className={cn(
                        "h-8 min-w-10 rounded-[2px] border px-3 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brass",
                        answers[q.id] === option
                          ? "border-brass bg-brass-fill text-on-brass"
                          : "border-rule-strong text-ink-muted hover:text-brass",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                  placeholder="Optional"
                  className="h-10 rounded-[2px] border border-rule-strong bg-transparent px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-brass"
                />
              )}
            </fieldset>
          ))}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-[2px] border border-danger px-3 py-2.5 text-xs text-danger"
            >
              <AlertCircle className="mt-px size-4 flex-shrink-0" />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <AuthButton
            type="submit"
            variant="filled"
            className="w-full"
            isLoading={saving}
            disabled={saving}
            icon={<ArrowRight className="size-4" />}
          >
            Start
          </AuthButton>
        </form>
      </AuthCard>
    </div>
  );
}
