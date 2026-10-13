import { usePostHog } from "@posthog/react";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, ArrowRight, Clock } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AuthButton } from "#/components/auth/AuthButton";
import type { ConsoleRun } from "#/components/ide/ConsoleDrawer";
import Problem, { formatCall } from "#/components/student/problem/Problem";
import { authClient } from "#/lib/auth-client";
import { defineEditorThemes, editorThemeFor } from "#/lib/editorThemes";
import { cn } from "#/lib/utils";
import { useTheme } from "next-themes";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CheckPhase } from "../../../convex/sessionFlow";
import { SessionPage } from "./SessionPage";

const CodeEditor = lazy(() => import("#/components/student/CodeEditor"));

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const DRAFT_SAVE_MS = 800;
/** Submit what's in the editor this long before the time runs out. */
const AUTO_SUBMIT_MS = 2_000;

type CheckProblem = {
  _id: Id<"checkProblems">;
  position: number;
  problem_name: string;
  problem_description: string;
  starter_code: string;
  example: { input: string; expectedOutput: string };
  answered: boolean;
};

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The HTTP response of a failed axios request, if there was one. */
function responseOf(
  err: unknown,
): { status?: number; data?: { detail?: string } } | undefined {
  return (err as { response?: { status?: number; data?: { detail?: string } } })
    ?.response;
}

async function authHeaders() {
  const token = (await authClient.convex.token()).data?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * A quick check (convex/quickChecks.ts): two short problems with the tutor
 * off, before or after the exercises. An intro first (the clock starts on
 * Start), then each problem in the workspace layout: Run checks the shown
 * example, Submit is final and shows no result. When time is nearly up, the
 * page submits what's in the editor.
 */
export function QuickCheckScreen({
  phase,
  step,
}: {
  phase: CheckPhase;
  step: string;
}) {
  const check = useQuery(api.quickChecks.mine, { phase });
  const start = useMutation(api.quickChecks.start);
  const [starting, setStarting] = useState(false);

  if (!check) {
    return (
      <div className="xa-workspace flex min-h-dvh items-center justify-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-label">
          Loading…
        </p>
      </div>
    );
  }

  if (!check.started) {
    return (
      <SessionPage
        step={step}
        title={
          phase === "pre" ? "Two short problems" : "Two more short problems"
        }
        intro={
          <p>
            {phase === "pre"
              ? "Before you start the exercises, try two short problems on your own. "
              : "Before the feedback survey, try two more short problems on your own. "}
            The tutor isn't available here, and you have {check.minutes}{" "}
            {check.minutes === 1 ? "minute" : "minutes"}. Do as much as you can:
            it isn't graded and doesn't count towards your course.
          </p>
        }
      >
        <ul className="mb-8 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-prose">
          <li>Run checks your code on the example shown.</li>
          <li>
            Submit is final: one Submit per problem, and you won't see the
            results.
          </li>
          <li>
            When the time runs out, what's in the editor is submitted for you.
          </li>
        </ul>
        <AuthButton
          variant="filled"
          isLoading={starting}
          icon={<ArrowRight className="size-4" />}
          onClick={async () => {
            setStarting(true);
            try {
              await start({ phase });
            } finally {
              setStarting(false);
            }
          }}
        >
          Start
        </AuthButton>
      </SessionPage>
    );
  }

  const problems = [...check.problems].sort((a, b) => a.position - b.position);
  const current = problems.find((p) => !p.answered);
  if (!current || check.endsAt === null) {
    return (
      <div className="xa-workspace flex min-h-dvh items-center justify-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-label">
          Saving…
        </p>
      </div>
    );
  }
  return (
    <CheckWorkspace
      key={current._id}
      problem={current}
      index={problems.indexOf(current)}
      total={problems.length}
      endsAt={check.endsAt}
    />
  );
}

function CheckWorkspace({
  problem,
  index,
  total,
  endsAt,
}: {
  problem: CheckProblem;
  index: number;
  total: number;
  endsAt: number;
}) {
  const posthog = usePostHog();
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<{ getValue: () => string } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [runs, setRuns] = useState<ConsoleRun[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const autoSent = useRef(false);
  const runId = useRef(0);

  // The code saved for this problem (a reload, a frozen PC), else the starter.
  const draft = useQuery(api.codeDrafts.get, { lessonId: problem._id });
  const saveDraft = useMutation(api.codeDrafts.save);
  useEffect(() => {
    if (code === null && draft !== undefined)
      setCode(draft?.code ?? problem.starter_code);
  }, [code, draft, problem.starter_code]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChange = (value: string | undefined) => {
    if (value === undefined) return;
    setCode(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft({ lessonId: problem._id, code: value }).catch(() => {});
    }, DRAFT_SAVE_MS);
  };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const currentCode = () =>
    editorRef.current?.getValue() ?? code ?? problem.starter_code;
  // The latest code reader for the timed auto-submit.
  const currentCodeRef = useRef(currentCode);
  currentCodeRef.current = currentCode;

  const submit = useCallback(
    async (auto: boolean) => {
      setSubmitting(true);
      setError("");
      try {
        const { default: axios } = await import("axios");
        await axios.post(
          `${BACKEND}/check/submit`,
          { check_id: problem._id, code: currentCodeRef.current(), auto },
          { headers: await authHeaders() },
        );
        posthog.capture("quick_check_submitted", {
          problem: problem.problem_name,
          auto,
        });
        // The next problem (or the next step) appears when Convex has the answer.
      } catch (err) {
        const res = responseOf(err);
        // 409: already answered or the check is over; the page moves on by itself.
        if (res?.status !== 409) {
          setError(
            res?.data?.detail || "Couldn't submit your answer. Try again.",
          );
          setSubmitting(false);
          setConfirming(false);
        }
      }
    },
    [problem._id, problem.problem_name, posthog],
  );

  const msLeft = endsAt - now;
  useEffect(() => {
    if (msLeft <= AUTO_SUBMIT_MS && !autoSent.current) {
      autoSent.current = true;
      submit(true);
    }
  }, [msLeft, submit]);

  const run = async () => {
    setIsRunning(true);
    setIsConsoleOpen(true);
    try {
      const { default: axios } = await import("axios");
      const { data } = await axios.post(
        `${BACKEND}/execute`,
        {
          code: currentCode(),
          language_id: 71,
          starter_code: problem.starter_code,
          test_cases: [{ ...problem.example, hidden: false }],
          action_type: "run",
        },
        { headers: await authHeaders() },
      );
      runId.current += 1;
      setRuns((prev) => [
        ...prev,
        {
          id: runId.current,
          at: new Date(),
          kind: "run",
          timeMs: data?.time_ms ?? null,
          call: formatCall(problem.problem_name, problem.example.input),
          returnValue: data?.return_value ?? null,
          stdout: data?.stdout ?? "",
          stderr: data?.stderr ?? "",
          inputNote: false,
        },
      ]);
    } catch (err) {
      runId.current += 1;
      setRuns((prev) => [
        ...prev,
        {
          id: runId.current,
          at: new Date(),
          kind: "error",
          stdout: "",
          stderr:
            responseOf(err)?.data?.detail ||
            "Couldn't reach the code runner. Try again in a moment.",
          inputNote: false,
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="xa-workspace flex h-dvh w-screen flex-col overflow-hidden bg-surface-page">
      <header className="flex h-9 flex-shrink-0 items-center justify-between border-b border-rule-strong bg-surface-void px-6 text-[10px] font-semibold uppercase tracking-[0.15em] select-none">
        <span className="text-ink-label">
          Quick check · problem {index + 1} of {total}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 tabular-nums",
            msLeft <= 60_000 ? "text-danger" : "text-ink-label",
          )}
        >
          <Clock className="size-3.5" aria-hidden="true" />
          {clock(msLeft)} left
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="w-[38%] min-w-[280px] overflow-y-auto border-r border-rule-strong">
          <div className="editorial-prose px-6 py-6">
            <Problem
              label="Problem:"
              problem={{
                id: problem._id,
                title: problem.problem_name,
                description: problem.problem_description,
                functionName: problem.problem_name,
                example: problem.example,
              }}
            />
          </div>
          <p className="px-6 pb-6 text-[11px] text-ink-label">
            No tutor in the quick check.
          </p>
        </section>

        <section className="relative flex min-w-0 flex-1 flex-col">
          {code === null ? (
            <div className="flex flex-1 items-center justify-center bg-surface-editor text-[10px] uppercase tracking-[0.15em] text-ink-label">
              Loading editor…
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center bg-surface-editor text-[10px] uppercase tracking-[0.15em] text-ink-label">
                  Loading editor…
                </div>
              }
            >
              <CodeEditor
                beforeMount={defineEditorThemes}
                theme={editorThemeFor(resolvedTheme)}
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
                language="python"
                value={code}
                onChange={onChange}
                fontSize={14}
                isRunning={isRunning}
                isSubmitting={submitting}
                runs={runs}
                onClearRuns={() => setRuns([])}
                isConsoleOpen={isConsoleOpen}
                setIsConsoleOpen={setIsConsoleOpen}
                onRun={run}
                onSubmit={() => setConfirming(true)}
              />
            </Suspense>
          )}

          {(confirming || error) && (
            <div
              role="dialog"
              aria-label="Submit this answer"
              className="absolute bottom-16 right-4 z-10 w-80 rounded-[4px] border border-rule-strong bg-surface-panel p-4 shadow-lg"
            >
              {error ? (
                <div
                  role="alert"
                  className="mb-3 flex items-start gap-2 text-xs text-danger"
                >
                  <AlertCircle className="mt-px size-4 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              ) : (
                <>
                  <p className="mb-1 text-sm font-medium text-ink">
                    Submit this answer?
                  </p>
                  <p className="mb-3 text-xs leading-relaxed text-ink-prose">
                    You can't change it after this, and you won't see how it
                    scored.
                    {index + 1 < total
                      ? ` Next: problem ${index + 2} of ${total}.`
                      : ""}
                  </p>
                </>
              )}
              <div className="flex gap-2">
                <AuthButton
                  variant="filled"
                  isLoading={submitting}
                  onClick={() => submit(false)}
                >
                  {error ? "Try again" : "Yes, submit"}
                </AuthButton>
                <AuthButton
                  variant="outlined"
                  disabled={submitting}
                  onClick={() => {
                    setConfirming(false);
                    setError("");
                  }}
                >
                  Keep working
                </AuthButton>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
