import { AlertCircle, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AuthButton } from "#/components/auth/AuthButton";
import { cn } from "#/lib/utils";
import type {
  SurveyAnswers,
  SurveyQuestion,
  SurveySection,
} from "../../../convex/surveys";
import { SessionPage } from "./SessionPage";

const chip = (on: boolean) =>
  cn(
    "h-8 min-w-9 rounded-[2px] border px-3 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brass",
    on
      ? "border-brass bg-brass-fill text-on-brass"
      : "border-rule-strong text-ink-muted hover:text-brass",
  );

function isAnswered(q: SurveyQuestion, a: SurveyAnswers) {
  const v = a[q.id];
  return Array.isArray(v) ? v.length > 0 : !!v?.trim();
}

/** Questions with options; a skipped one gets a gentle reminder (text boxes don't). */
const hasOptions = (q: SurveyQuestion) =>
  q.type !== "text" && q.type !== "long";

const DRAFT_SAVE_MS = 800;

/**
 * One of the session's surveys (convex/surveys.ts). Answers are saved as the
 * student goes: to the tab at once (a reload) and to the server shortly
 * after (a frozen or restarted computer, or moving to another one). The tab
 * copy is session storage, so it doesn't outlive the tab on a shared PC.
 * Every question can be skipped: on submit, skipped ones are pointed out
 * once, then "Submit anyway" goes ahead.
 */
export function SurveyScreen({
  storageKey,
  step,
  title,
  intro,
  sections,
  submitLabel,
  serverDraft,
  onSaveDraft,
  onSubmit,
}: {
  storageKey: string;
  step: string;
  title: string;
  intro: string;
  sections: readonly SurveySection[];
  submitLabel: string;
  /** Answers saved on the server earlier (convex/cohorts.ts saveSurveyDraft). */
  serverDraft: SurveyAnswers;
  onSaveDraft: (answers: SurveyAnswers) => Promise<unknown>;
  onSubmit: (answers: SurveyAnswers) => Promise<unknown>;
}) {
  const [answers, setAnswers] = useState<SurveyAnswers>(() => {
    try {
      const local = sessionStorage.getItem(storageKey);
      if (local) return JSON.parse(local);
    } catch {}
    return serverDraft;
  });
  const [showSkipped, setShowSkipped] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Save to the tab at once, and to the server once typing pauses; flush
  // when the page is hidden or closed.
  // Not on first render: nothing has changed yet (and serverDraft itself
  // changes with every save, so it can't be a dependency).
  const loaded = useRef(answers);
  const unsaved = useRef<SurveyAnswers | null>(null);
  const saveDraft = useRef(onSaveDraft);
  saveDraft.current = onSaveDraft;
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {}
    if (answers === loaded.current) return;
    unsaved.current = answers;
    const t = setTimeout(() => {
      unsaved.current = null;
      saveDraft.current(answers).catch(() => {});
    }, DRAFT_SAVE_MS);
    return () => clearTimeout(t);
  }, [storageKey, answers]);
  useEffect(() => {
    const flush = () => {
      if (!unsaved.current) return;
      saveDraft.current(unsaved.current).catch(() => {});
      unsaved.current = null;
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  const set = (id: string, value: string | string[]) =>
    setAnswers((a) => ({ ...a, [id]: value }));
  const skipped = sections
    .flatMap((s) => s.questions)
    .filter((q) => hasOptions(q) && !isAnswered(q, answers));

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (skipped.length && !showSkipped) {
      setShowSkipped(true);
      document
        .getElementById(`q-${skipped[0].id}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setSaving(true);
    setError("");
    try {
      unsaved.current = null;
      await onSubmit(answers);
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
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
    <SessionPage
      step={step}
      title={title}
      intro={<p>{intro} You can skip any question you'd rather not answer.</p>}
    >
      <form onSubmit={submit} className="flex flex-col gap-12" noValidate>
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-8">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
              {section.title}
            </h2>
            {section.questions.map((q) => (
              <Question
                key={q.id}
                q={q}
                value={answers[q.id]}
                onChange={(v) => set(q.id, v)}
                flagged={
                  showSkipped && hasOptions(q) && !isAnswered(q, answers)
                }
              />
            ))}
          </section>
        ))}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[2px] border border-danger px-3 py-2.5 text-xs text-danger"
          >
            <AlertCircle className="mt-px size-4 flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}
        {showSkipped && skipped.length > 0 && (
          <p role="status" className="text-sm leading-relaxed text-ink">
            You skipped{" "}
            {skipped.length === 1
              ? "one question"
              : `${skipped.length} questions`}{" "}
            (marked above). That's fine: answer{" "}
            {skipped.length === 1 ? "it" : "them"} if you'd like, or submit
            anyway.
          </p>
        )}
        <div className="border-t border-rule-strong pt-6">
          <AuthButton
            type="submit"
            variant="filled"
            isLoading={saving}
            disabled={saving}
            icon={<ArrowRight className="size-4" />}
          >
            {showSkipped && skipped.length > 0 ? "Submit anyway" : submitLabel}
          </AuthButton>
        </div>
      </form>
    </SessionPage>
  );
}

function Question({
  q,
  value,
  onChange,
  flagged,
}: {
  q: SurveyQuestion;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  flagged: boolean;
}) {
  return (
    <fieldset
      id={`q-${q.id}`}
      className={cn(
        "m-0 min-w-0 border-0 p-0",
        flagged && "border-l-2 border-brass pl-3",
      )}
    >
      <legend className="mb-3 text-sm font-medium leading-snug text-ink">
        {q.label}
      </legend>

      {q.type === "choice" && (
        <div className="flex flex-wrap gap-2">
          {q.options.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={value === o}
              // Clicking the chosen answer again clears it (skip after all).
              onClick={() => onChange(value === o ? "" : o)}
              className={chip(value === o)}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      {q.type === "multi" && (
        <div className="flex flex-wrap gap-2">
          {q.options.map((o) => {
            const picked = Array.isArray(value) ? value : [];
            const on = picked.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? picked.filter((p) => p !== o) : [...picked, o])
                }
                className={chip(on)}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}

      {q.type === "scale" && (
        <div className="max-w-full overflow-x-auto">
          <div className="inline-flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              {Array.from({ length: q.max - q.min + 1 }, (_, i) =>
                String(q.min + i),
              ).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={value === n}
                  aria-label={`${n}${n === String(q.min) ? `, ${q.minLabel}` : n === String(q.max) ? `, ${q.maxLabel}` : ""}`}
                  onClick={() => onChange(value === n ? "" : n)}
                  className={cn(chip(value === n), "w-9 px-0 tabular-nums")}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between gap-6 text-[11px] text-ink-label">
              <span>{q.minLabel}</span>
              <span className="text-right">{q.maxLabel}</span>
            </div>
          </div>
        </div>
      )}

      {q.type === "text" && (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-[2px] border border-rule-strong bg-transparent px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-brass"
        />
      )}

      {q.type === "long" && (
        <textarea
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[2px] border border-rule-strong bg-transparent px-3 py-2 text-sm leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-brass"
        />
      )}
    </fieldset>
  );
}
