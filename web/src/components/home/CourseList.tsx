import { usePostHog } from "@posthog/react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Compass,
  HelpCircle,
  Lock,
  PlayCircle,
  Search,
} from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/utils.ts";
import { api } from "../../../convex/_generated/api";

export type ShortProblem = {
  id: string;
  name: string;
  description: string;
  week: number;
  status: "completed" | "in-progress" | "pending";
  language: "Python";
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  // acceptance: string
};

/*
const MOCK_METADATA: Record<string, Partial<ShortProblem>> = {
  "Two Sum": {
    status: "completed",
    difficulty: "Easy",
    tags: ["Array", "Hash Table"],
    acceptance: "54.2%",
  },
  "Valid Parentheses": {
    status: "completed",
    difficulty: "Easy",
    tags: ["Stack", "String"],
    acceptance: "41.5%",
  },
  "Merge Two Sorted Lists": {
    status: "in-progress",
    difficulty: "Medium",
    tags: ["Linked List", "Recursion"],
    acceptance: "63.7%",
  },
  "Maximum Subarray": {
    status: "pending",
    difficulty: "Medium",
    tags: ["Array", "Divide & Conquer"],
    acceptance: "50.1%",
  },
  "Binary Tree Inorder Traversal": {
    status: "pending",
    difficulty: "Easy",
    tags: ["Tree", "DFS"],
    acceptance: "74.8%",
  },
  "Clone Graph": {
    status: "pending",
    difficulty: "Medium",
    tags: ["Graph", "BFS"],
    acceptance: "56.2%",
  },
  "Course Schedule": {
    status: "pending",
    difficulty: "Hard",
    tags: ["Graph", "DFS", "BFS"],
    acceptance: "60.4%",
  },
  "Longest Palindromic Substring": {
    status: "pending",
    difficulty: "Medium",
    tags: ["String", "Dynamic Programming"],
    acceptance: "34.1%",
  },
}
*/

export default function CourseList() {
  const questions = useQuery(api.courses.getAllCourses);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<number | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<
    ShortProblem["status"] | "all"
  >("all");
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<number, boolean>>(
    {},
  );

  if (questions === undefined) {
    return (
      <div className="space-y-6 animate-pulse">
        <div>
          <div className="h-6 w-48 bg-zinc-200 rounded"></div>
          <div className="h-4 w-72 bg-zinc-100 rounded mt-2"></div>
        </div>
        <div className="h-24 bg-zinc-200/50 rounded-xl border border-line"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-zinc-200/30 rounded-xl border border-line"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  const problems: ShortProblem[] = questions.map((q: any) => {
    return {
      id: q._id,
      name: q.problem_name,
      description: q.problem_description,
      week: q.week,
      status: "pending",
      language: "Python",
      difficulty: "Easy",
      tags: [],
      // acceptance: "50.0%",
    };
  });

  // Filter problems based on states
  const filteredProblems = problems.filter((problem) => {
    const matchesSearch =
      problem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      problem.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      problem.tags.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesWeek = selectedWeek === "all" || problem.week === selectedWeek;
    const matchesStatus =
      selectedStatus === "all" || problem.status === selectedStatus;

    return matchesSearch && matchesWeek && matchesStatus;
  });

  // Group filtered problems by week
  const problemsByWeek = filteredProblems.reduce<
    Record<number, ShortProblem[]>
  >((groups, problem) => {
    if (!groups[problem.week]) {
      groups[problem.week] = [];
    }
    groups[problem.week].push(problem);
    return groups;
  }, {});

  // Get sorted list of active weeks
  const sortedWeeks = Object.keys(problemsByWeek)
    .map(Number)
    .sort((a, b) => a - b);

  const toggleWeek = (weekNum: number) => {
    setCollapsedWeeks((prev) => ({
      ...prev,
      [weekNum]: !prev[weekNum],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Title & Introduction */}
      <div>
        <h2 className="text-xl font-extrabold text-sea-ink tracking-tight flex items-center gap-2">
          <Compass className="size-5 text-lagoon-deep" />
          <span>Python Programming Syllabus</span>
        </h2>
        <p className="text-sm text-sea-ink-soft mt-1">
          Complete the challenges below sequentially. Use the workspace editor
          to run and submit your solutions.
        </p>
      </div>

      {/* Interactive Controls (Search & Filters) */}
      <div className="island-shell rounded-xl p-4 border border-line space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-sea-ink-soft/60" />
            <input
              type="text"
              placeholder="Search problems, descriptions, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-sand/35 border border-line rounded-lg py-2 pl-9 pr-4 text-sm text-sea-ink placeholder:text-sea-ink-soft/40 outline-none focus:border-lagoon-deep focus:ring-1 focus:ring-lagoon-deep/30 transition-all"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex bg-sand/40 border border-line rounded-lg p-1 shrink-0">
            {(["all", "completed", "in-progress", "pending"] as const).map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold capitalize rounded-md transition-colors cursor-pointer",
                    selectedStatus === status
                      ? "bg-white text-sea-ink shadow-sm border border-line/20"
                      : "text-sea-ink-soft hover:text-sea-ink",
                  )}
                >
                  {status === "all" ? "All Status" : status.replace("-", " ")}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Week filter tabs */}
        <div className="flex flex-wrap gap-1.5 border-t border-line/50 pt-3">
          <button
            onClick={() => setSelectedWeek("all")}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-colors",
              selectedWeek === "all"
                ? "bg-sea-ink text-white border-sea-ink"
                : "bg-sand/30 border-line text-sea-ink hover:bg-sand/65",
            )}
          >
            All Weeks
          </button>
          {[1, 2, 3, 4].map((wk) => (
            <button
              key={wk}
              onClick={() => setSelectedWeek(wk)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-colors",
                selectedWeek === wk
                  ? "bg-sea-ink text-white border-sea-ink"
                  : "bg-sand/30 border-line text-sea-ink hover:bg-sand/65",
              )}
            >
              Week {wk}
            </button>
          ))}
        </div>
      </div>

      {/* Problems List Stack grouped by Week */}
      {sortedWeeks.length > 0 ? (
        <div className="space-y-6">
          {sortedWeeks.map((weekNum) => {
            const isCollapsed = collapsedWeeks[weekNum];
            const weekProblems = problemsByWeek[weekNum];

            return (
              <div key={weekNum} className="space-y-3">
                <button
                  onClick={() => toggleWeek(weekNum)}
                  className="w-full flex items-center justify-between border-b border-line pb-1.5 hover:border-lagoon-deep text-left cursor-pointer group transition-colors"
                >
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-sea-ink-soft group-hover:text-sea-ink">
                    Week {weekNum} ({weekProblems.length}{" "}
                    {weekProblems.length === 1 ? "exercise" : "exercises"})
                  </h3>
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-sea-ink-soft group-hover:text-sea-ink" />
                  ) : (
                    <ChevronDown className="size-4 text-sea-ink-soft group-hover:text-sea-ink" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="flex flex-col gap-3">
                    {weekProblems.map((problem) => (
                      <ShortProblemCard key={problem.id} {...problem} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="island-shell rounded-xl p-10 text-center border border-line">
          <HelpCircle className="size-8 text-sea-ink-soft/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-sea-ink">
            No exercises found
          </p>
          <p className="text-xs text-sea-ink-soft mt-1">
            Try adjusting your search criteria or selected filters.
          </p>
        </div>
      )}
    </div>
  );
}

function ShortProblemCard({
  id,
  name,
  description,
  week,
  status,
  language,
  difficulty,
  tags,
}: ShortProblem) {
  const posthog = usePostHog();
  const difficultyStyles = {
    Easy: "text-emerald-600 bg-emerald-50 border-emerald-200/50",
    Medium: "text-amber-600 bg-amber-50 border-amber-200/50",
    Hard: "text-rose-600 bg-rose-50 border-rose-200/50",
  };

  return (
    <div className="feature-card rounded-xl border border-line p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      {/* Left side: status icon, title, details */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="shrink-0">
          {status === "completed" && (
            <span title="Completed">
              <CheckCircle2 className="size-5 text-palm" />
            </span>
          )}
          {status === "in-progress" && (
            <span title="In Progress">
              <PlayCircle className="size-5 text-amber-600" />
            </span>
          )}
          {status === "pending" && (
            <span title="Locked">
              <Lock className="size-5 text-sea-ink-soft/40" />
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm text-sea-ink truncate">{name}</h3>
            <span className="bg-lagoon/10 text-lagoon-deep border border-lagoon/20 text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0">
              W{week}
            </span>
            <span
              className={cn(
                "border text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0",
                difficultyStyles[difficulty],
              )}
            >
              {difficulty}
            </span>
          </div>
          <p className="text-xs text-sea-ink-soft truncate mt-0.5 max-w-[320px] md:max-w-[420px]">
            {description}
          </p>
        </div>
      </div>

      {/* Right side: language, tags, solve link */}
      <div className="flex items-center gap-3 justify-between sm:justify-end w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-line/30 pt-3 sm:pt-0">
        <div className="hidden md:flex flex-wrap gap-1">
          {tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[9px] font-medium text-sea-ink-soft bg-sand/30 border border-line/60 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>

        <span className="text-[10px] font-bold text-sea-ink-soft bg-sand/50 px-2 py-0.5 rounded border border-line">
          {language}
        </span>

        <Link
          to="/course"
          search={{ problemId: id }}
          onClick={() =>
            posthog.capture("problem_started", {
              problem_id: id,
              problem_name: name,
              week,
              difficulty,
              action:
                status === "completed"
                  ? "review"
                  : status === "in-progress"
                    ? "resume"
                    : "start",
            })
          }
          className={cn(
            "text-xs font-bold px-3 py-1.5 rounded-lg border text-center transition-colors flex items-center gap-1 cursor-pointer",
            status === "completed"
              ? "bg-sand/30 border-line text-sea-ink hover:bg-sand/65"
              : status === "in-progress"
                ? "bg-palm text-white border-palm hover:bg-palm/90"
                : "bg-white border-line text-sea-ink hover:bg-sand/35",
          )}
        >
          {status === "completed"
            ? "Review"
            : status === "in-progress"
              ? "Resume"
              : "Start"}
        </Link>
      </div>
    </div>
  );
}

// Deprecated original function kept for absolute backward compatibility
export function ShortProblem({
  name,
  description,
  week,
  status,
  language,
}: Omit<ShortProblem, "id" | "difficulty" | "tags">) {
  return (
    <div className="border border-line rounded-lg p-3 bg-white">
      <h1 className="font-bold text-lg">{name}</h1>
      <p className="text-sm">{description}</p>
      <p className="text-xs text-sea-ink-soft">Week: {week}</p>
      <p className="text-xs font-medium">Status: {status}</p>
      <p className="text-xs text-lagoon-deep">Language: {language}</p>
    </div>
  );
}
