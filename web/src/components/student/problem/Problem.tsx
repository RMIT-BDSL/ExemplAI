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

/** Outcome of the latest Submit in this session (cleared on reload / lesson change). */
export interface LastSubmit {
  passed: number;
  total: number;
  /** The example's own result, when the server returned it (not hidden). */
  example?: { passed: boolean; stdout: string; stderr: string };
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

export interface ProblemProps {
  problem: ProblemData;
  lastSubmit?: LastSubmit;
}

export default function Problem({ problem, lastSubmit }: ProblemProps) {
  const { example } = problem;
  const exampleResult = lastSubmit?.example;
  const allPassed =
    lastSubmit !== undefined && lastSubmit.passed === lastSubmit.total;

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
            <dd className="font-mono text-ink break-all">
              {example.expectedOutput}
            </dd>
            {exampleResult && (
              <>
                <dt className="text-[11px] text-ink-label">Your output</dt>
                <dd
                  className={`font-mono break-all ${exampleResult.passed ? "text-success" : "text-danger"}`}
                >
                  {exampleResult.stdout.trim() ||
                    (exampleResult.stderr
                      ? lastLine(exampleResult.stderr)
                      : "(nothing returned)")}
                  <b className="ml-2 font-sans text-[9px] font-semibold tracking-[0.1em]">
                    {exampleResult.passed ? "PASS" : "FAIL"}
                  </b>
                </dd>
              </>
            )}
          </dl>
        </section>
      )}

      {lastSubmit && (
        // A div, not a p: .editorial-prose forces serif styling on paragraphs.
        <div
          className="mt-4 border-t border-rule pt-4 font-sans text-xs"
          aria-live="polite"
        >
          <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-label">
            Last submit
          </span>
          <span className={allPassed ? "text-success" : "text-danger"}>
            {lastSubmit.passed} of {lastSubmit.total} tests passed
          </span>
        </div>
      )}
    </article>
  );
}
