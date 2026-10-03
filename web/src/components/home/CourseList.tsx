import { usePostHog } from "@posthog/react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { authClient } from "#/lib/auth-client";
import { cn } from "#/lib/utils.ts";
import { api } from "../../../convex/_generated/api";

type Status = "completed" | "in-progress" | "pending";

export type ShortProblem = {
  id: string;
  name: string;
  description: string;
  week: number;
  topic?: string;
  status: Status;
};

const STATUS_FILTERS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Not started" },
  { value: "in-progress", label: "Started" },
  { value: "completed", label: "Done" },
];

/** Strip markdown backticks for the one-line description preview. */
function plain(text: string) {
  return text.replace(/`/g, "");
}

/**
 * Syllabus: the course as a book-style contents list grouped by week (same
 * language as the workspace's lesson index), with search and filters.
 */
export default function CourseList() {
  const questions = useQuery(api.courses.getAllCourses);

  // The Convex client isn't authenticated, so read the session from the
  // Better Auth client (same pattern as the rest of the app).
  const { data: session } = authClient.useSession();
  const tokenIdentifier = session?.user?.id;
  const lessonProgress = useQuery(
    api.courses.getLessonProgress,
    tokenIdentifier ? {} : "skip",
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<number | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<Status | "all">("all");
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<number, boolean>>(
    {},
  );

  const problems: ShortProblem[] = useMemo(() => {
    // lessonId -> status. Lessons absent from the map are "pending".
    const progressByLesson = new Map(
      (lessonProgress ?? []).map((p) => [p.lessonId, p.status]),
    );
    return (questions ?? []).map((q: any) => ({
      id: q._id,
      name: q.problem_name,
      description: q.problem_description,
      week: q.week,
      topic: q.topic,
      status: (progressByLesson.get(q._id) as Status | undefined) ?? "pending",
    }));
  }, [questions, lessonProgress]);

  // Every week that has lessons, not a fixed list.
  const allWeeks = useMemo(
    () => [...new Set(problems.map((p) => p.week))].sort((a, b) => a - b),
    [problems],
  );

  if (questions === undefined) {
    return <SyllabusSkeleton />;
  }

  const term = searchTerm.trim().toLowerCase();
  const filteredProblems = problems.filter(
    (p) =>
      (term === "" ||
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        (p.topic ?? "").toLowerCase().includes(term)) &&
      (selectedWeek === "all" || p.week === selectedWeek) &&
      (selectedStatus === "all" || p.status === selectedStatus),
  );

  const problemsByWeek = filteredProblems.reduce<
    Record<number, ShortProblem[]>
  >((groups, p) => {
    if (!groups[p.week]) groups[p.week] = [];
    groups[p.week].push(p);
    return groups;
  }, {});
  const sortedWeeks = Object.keys(problemsByWeek)
    .map(Number)
    .sort((a, b) => a - b);

  const totalDone = problems.filter((p) => p.status === "completed").length;

  return (
    <div>
      {/* Title */}
      <header className="mb-8">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
          Syllabus
        </p>
        <h1 className="font-serif text-[1.6rem] font-medium leading-tight tracking-[-0.02em] text-ink">
          Python Programming
        </h1>
        <p className="mt-2 font-serif text-[0.95rem] leading-[1.75] text-ink-prose">
          Work through the exercises in order. Each one opens in the workspace,
          where you can run your code, submit it, and ask the tutor for help.
        </p>
        <p className="mt-3 text-[11px] text-ink-label">
          {totalDone} of {problems.length} exercises done
        </p>
      </header>

      {/* Search and filters */}
      <div className="mb-8 space-y-3 border-y border-rule-strong py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search exercises</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-label" />
            <input
              type="search"
              placeholder="Search exercises or topics…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-full rounded-[2px] border border-rule bg-surface-raised pl-9 pr-3 text-xs text-ink outline-none placeholder:text-ink-label focus:border-brass"
            />
          </label>

          <fieldset
            aria-label="Filter by status"
            className="m-0 flex min-w-0 shrink-0 overflow-hidden rounded-[2px] border border-rule-strong p-0"
          >
            {STATUS_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={selectedStatus === value}
                onClick={() => setSelectedStatus(value)}
                className={cn(
                  "h-8 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors cursor-pointer [&+&]:border-l [&+&]:border-rule-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass",
                  selectedStatus === value
                    ? "bg-brass-fill text-on-brass"
                    : "text-ink-muted hover:text-brass",
                )}
              >
                {label}
              </button>
            ))}
          </fieldset>
        </div>

        <fieldset
          aria-label="Filter by week"
          className="m-0 flex min-w-0 flex-wrap gap-x-4 gap-y-1 border-0 p-0"
        >
          {(["all", ...allWeeks] as const).map((wk) => (
            <button
              key={wk}
              type="button"
              aria-pressed={selectedWeek === wk}
              onClick={() => setSelectedWeek(wk)}
              className={cn(
                "border-b py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
                selectedWeek === wk
                  ? "border-brass text-brass"
                  : "border-transparent text-ink-label hover:text-ink",
              )}
            >
              {wk === "all" ? "All weeks" : `Week ${wk}`}
            </button>
          ))}
        </fieldset>
      </div>

      {/* Contents, grouped by week */}
      {sortedWeeks.length > 0 ? (
        <div className="space-y-8">
          {sortedWeeks.map((weekNum) => {
            const isCollapsed = collapsedWeeks[weekNum];
            const weekProblems = problemsByWeek[weekNum];
            const doneCount = weekProblems.filter(
              (p) => p.status === "completed",
            ).length;
            const topic = weekProblems[0]?.topic;
            return (
              <section key={weekNum} aria-labelledby={`week-${weekNum}`}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedWeeks((prev) => ({
                      ...prev,
                      [weekNum]: !prev[weekNum],
                    }))
                  }
                  aria-expanded={!isCollapsed}
                  className="group mb-2 flex w-full items-center gap-3 text-left cursor-pointer"
                >
                  <h2
                    id={`week-${weekNum}`}
                    className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-brass"
                  >
                    Week {weekNum}
                    {topic && (
                      <span className="font-medium text-ink-label">
                        {" "}
                        · {topic}
                      </span>
                    )}
                  </h2>
                  <span className="h-px flex-1 bg-rule-strong" />
                  <span className="shrink-0 text-[10px] tabular-nums text-ink-label">
                    {doneCount}/{weekProblems.length} done
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="size-3.5 shrink-0 text-ink-label group-hover:text-brass" />
                  ) : (
                    <ChevronDown className="size-3.5 shrink-0 text-ink-label group-hover:text-brass" />
                  )}
                </button>

                {!isCollapsed && (
                  <ul>
                    {weekProblems.map((problem) => (
                      <LessonRow key={problem.id} {...problem} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="border-y border-rule py-10 text-center">
          <p className="font-serif text-[0.95rem] text-ink">
            No exercises match.
          </p>
          <p className="mt-1 text-[11px] text-ink-label">
            Try a different search, week or status.
          </p>
        </div>
      )}
    </div>
  );
}

const ROW_STATUS = {
  completed: { label: "✓ Done", labelClass: "text-success", action: "Review" },
  "in-progress": {
    label: "Started",
    labelClass: "text-brass",
    action: "Resume",
  },
  pending: { label: "", labelClass: "text-ink-label", action: "Start" },
} as const;

function LessonRow({ id, name, description, week, status }: ShortProblem) {
  const posthog = usePostHog();
  const s = ROW_STATUS[status];
  const primary = status === "in-progress";

  return (
    <li className="group flex items-center gap-4 border-b border-rule py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-serif text-[15px] text-ink">
            {name}
          </span>
          <span className="min-w-6 flex-1 self-center border-b border-dotted border-rule-strong" />
          {s.label && (
            <span
              className={cn(
                "shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]",
                s.labelClass,
              )}
            >
              {s.label}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-ink-label">
          {plain(description)}
        </p>
      </div>

      <Link
        to="/course"
        search={{ problemId: id }}
        onClick={() =>
          posthog.capture("problem_started", {
            problem_id: id,
            problem_name: name,
            week,
            action:
              status === "completed"
                ? "review"
                : status === "in-progress"
                  ? "resume"
                  : "start",
          })
        }
        aria-label={`${s.action} ${name}`}
        className={cn(
          "flex h-7 w-[72px] shrink-0 items-center justify-center rounded-[2px] border text-[11px] font-semibold tracking-[0.02em] transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
          primary
            ? "border-brass-fill bg-brass-fill text-on-brass hover:opacity-90"
            : "border-rule-strong text-brass hover:bg-surface-raised",
        )}
      >
        {s.action}
      </Link>
    </li>
  );
}

export function SyllabusSkeleton() {
  const bar = "rounded bg-rule-strong animate-pulse";
  return (
    <div aria-hidden="true">
      <div className={`mb-3 h-2.5 w-16 ${bar}`} />
      <div className={`mb-3 h-7 w-64 ${bar}`} />
      <div className={`mb-8 h-4 w-full max-w-md ${bar}`} />
      <div className="mb-8 h-24 border-y border-rule-strong" />
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-rule py-4"
        >
          <div className={`h-4 flex-1 ${bar}`} />
          <div className="h-7 w-[72px] rounded-[2px] border border-rule-strong" />
        </div>
      ))}
    </div>
  );
}
