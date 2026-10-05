import ReactMarkdown from "react-markdown";

export interface ProblemData {
  id: string;
  title: string;
  description: string;
  /** Name of the function students write (from the starter code). */
  functionName: string;
  /** The one test case shown to students as a worked example. */
  example?: { input: string; expectedOutput: string };
}

/** Outcome of a Submit in this session (cleared on reload / lesson change). */
export interface LastSubmit {
  passed: number;
  total: number;
  /** The example's own result, when the server returned it (not hidden). */
  example?: { passed: boolean; stdout: string; stderr: string };
}

/** One Submit in this session's history for the current lesson. */
export interface SubmitRecord extends LastSubmit {
  lessonId: string;
  at: Date;
}

function submitTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Render a test-case input as a Python call, mirroring how the server's test
 * runner turns stdin into arguments (server/services wrap_code_with_runner):
 * empty → no args; a JSON list → that argument list; otherwise comma-separated
 * JSON values, falling back to whitespace-separated tokens.
 */
export function formatCall(functionName: string, input: string): string {
  const raw = input.trim();
  const show = (v: unknown) =>
    typeof v === "string" ? `"${v}"` : JSON.stringify(v);
  let args: string[];
  if (raw === "") {
    args = [];
  } else {
    try {
      const parsed =
        raw.startsWith("[") && raw.endsWith("]")
          ? JSON.parse(raw)
          : JSON.parse(`[${raw}]`);
      args = (Array.isArray(parsed) ? parsed : [parsed]).map(show);
    } catch {
      args = raw
        .split(/\s+/)
        .map((t) => (Number.isFinite(Number(t)) ? t : `"${t}"`));
    }
  }
  return `${functionName}(${args.join(", ")})`;
}

function lastLine(text: string): string {
  const lines = text.trim().split("\n");
  return lines[lines.length - 1] ?? "";
}

/** What the student's code gave for the example: output, else the error line. */
function exampleOutput(result: NonNullable<LastSubmit["example"]>): string {
  return (
    result.stdout.trim() ||
    (result.stderr ? lastLine(result.stderr) : "(nothing returned)")
  );
}

export interface ProblemProps {
  problem: ProblemData;
  /** This session's Submits on the lesson, newest first. */
  submitHistory?: SubmitRecord[];
}

export default function Problem({ problem, submitHistory = [] }: ProblemProps) {
  const lastSubmit = submitHistory[0];
  const { example } = problem;
  const exampleResult = lastSubmit?.example;

  return (
    <article>
      <h1 className="!mb-4 flex items-baseline gap-3">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-label">
          Exercise:
        </span>
        <span>{problem.title}</span>
      </h1>

      <ReactMarkdown>{problem.description}</ReactMarkdown>

      {example && (
        <section className="mt-6 border-t border-rule-strong pt-4 font-sans">
          <h2 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-label">
            Example
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-xs">
            <dt className="text-[11px] text-ink-label">Input</dt>
            <dd className="font-mono text-ink break-all">
              {formatCall(problem.functionName, example.input)}
            </dd>
            <dt className="text-[11px] text-ink-label">Expected</dt>
            {/* pre-wrap: outputs can span lines (e.g. "Hello\nWorld"). */}
            <dd className="font-mono text-ink break-all whitespace-pre-wrap">
              {example.expectedOutput}
            </dd>
            {exampleResult && (
              <>
                <dt className="text-[11px] text-ink-label">Your output</dt>
                <dd
                  className={`font-mono break-all whitespace-pre-wrap ${exampleResult.passed ? "text-success" : "text-danger"}`}
                >
                  {exampleOutput(exampleResult)}
                  <b className="ml-2 font-sans text-[9px] font-semibold tracking-[0.1em]">
                    {exampleResult.passed ? "PASS" : "FAIL"}
                  </b>
                </dd>
              </>
            )}
          </dl>
        </section>
      )}

      {submitHistory.length > 0 && (
        // Divs, not p/ul: .editorial-prose forces serif styling on those.
        <div
          className="mt-4 border-t border-rule pt-4 font-sans text-xs"
          aria-live="polite"
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-label">
            Submit history
          </div>
          <div className="space-y-1">
            {submitHistory.map((s, i) => {
              const passedAll = s.total > 0 && s.passed === s.total;
              return (
                <div key={s.at.getTime() + "-" + i} className="flex items-baseline gap-3">
                  <span className="flex-shrink-0 whitespace-nowrap tabular-nums text-ink-label">
                    {submitTime(s.at)}
                  </span>
                  <div className="min-w-0">
                    <div className={passedAll ? "text-success" : "text-danger"}>
                      {passedAll ? "✓" : "✗"} {s.passed} of {s.total} tests passed
                    </div>
                    {/* The example's output on that Submit, as a trace of attempts. */}
                    {s.example && (
                      <div className="mt-0.5 font-mono text-[11px] text-ink-muted break-all whitespace-pre-wrap">
                        {exampleOutput(s.example)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}
