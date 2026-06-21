import { Tag } from "lucide-react";
import ReactMarkdown from "react-markdown";

// Types for Problem
/*
export interface Example {
  input: string
  output: string
  explanation?: string
}
*/

export interface ProblemData {
  id: string;
  title: string;
  // difficulty: "Easy" | "Medium" | "Hard"
  // acceptanceRate: string
  tags: string[];
  description: string;
  // examples: Example[]
  // constraints: string[]
}

// Mock Problem Data for initial design
export const MOCK_PROBLEM: ProblemData = {
  id: "1",
  title: "1. Two Sum",
  // difficulty: "Easy",
  // acceptanceRate: "54.2%",
  tags: ["Array", "Hash Table"],
  description:
    "Given an array of integers `nums` and an integer `target`, return *indices of the two numbers* such that they add up to `target`.\n\nYou may assume that each input would have ***exactly* one solution**, and you may not use the *same* element twice.\n\nYou can return the answer in any order.",
  /*
  examples: [
    {
      input: "nums = [2,7,11,15], target = 9",
      output: "[0,1]",
      explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
    },
    {
      input: "nums = [3,2,4], target = 6",
      output: "[1,2]",
      explanation: "Because nums[1] + nums[2] == 6, we return [1, 2]."
    },
    {
      input: "nums = [3,3], target = 6",
      output: "[0,1]"
    }
  ],
  constraints: [
    "2 <= nums.length <= 10^4",
    "-10^9 <= nums[i] <= 10^9",
    "-10^9 <= target <= 10^9",
    "Only one valid answer exists."
  ]
  */
};

// 1. Problem Header Component
export interface ProblemHeaderProps {
  title: string;
  // difficulty: "Easy" | "Medium" | "Hard"
  // acceptanceRate: string
  tags: string[];
}

export function ProblemHeader({
  title,
  /* difficulty, acceptanceRate, */ tags,
}: ProblemHeaderProps) {
  /*
  const difficultyStyles = {
    Easy: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    Medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    Hard: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  }
  */

  return (
    <div className="space-y-4 border-b border-zinc-800 pb-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          {title}
        </h1>
        {/*
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold select-none",
              difficultyStyles[difficulty]
            )}
          >
            {difficulty}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/50 px-2.5 py-0.5 text-xs text-zinc-400 select-none">
            <CheckCircle className="size-3 text-zinc-500" />
            Acceptance: {acceptanceRate}
          </span>
        </div>
        */}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Tag className="mr-1 size-3.5 text-zinc-500" />
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-md border border-zinc-800/80 bg-zinc-950 px-2 py-0.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-300"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// 2. Problem Description Text Component
export interface ProblemDescriptionTextProps {
  description: string;
}

export function ProblemDescriptionText({
  description,
}: ProblemDescriptionTextProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-zinc-300">
      <ReactMarkdown>{description}</ReactMarkdown>
    </div>
  );
}

/*
// 3. Problem Examples Component
export interface ProblemExamplesProps {
  examples: Example[]
}

export function ProblemExamples({ examples }: ProblemExamplesProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-zinc-800/50 pb-2">
        <Code2 className="size-4 text-indigo-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Examples
        </h2>
      </div>

      <div className="space-y-4">
        {examples.map((example, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400">
              Example {idx + 1}:
            </h3>
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 font-mono text-sm leading-6">
              <div className="flex flex-col gap-1">
                <div>
                  <span className="font-semibold text-zinc-500 select-none">Input:</span>{" "}
                  <span className="text-zinc-200">{example.input}</span>
                </div>
                <div>
                  <span className="font-semibold text-zinc-500 select-none">Output:</span>{" "}
                  <span className="text-zinc-200">{example.output}</span>
                </div>
                {example.explanation && (
                  <div className="mt-2 border-t border-zinc-800/60 pt-2 text-zinc-400">
                    <span className="font-semibold text-zinc-500 select-none font-sans mr-1">
                      Explanation:
                    </span>
                    <span className="font-sans text-xs">
                      {example.explanation}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 4. Problem Constraints Component
export interface ProblemConstraintsProps {
  constraints: string[]
}

export function ProblemConstraints({ constraints }: ProblemConstraintsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-zinc-800/50 pb-2">
        <Cpu className="size-4 text-emerald-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Constraints
        </h2>
      </div>

      <ul className="list-inside list-disc space-y-2 pl-1 text-xs text-zinc-400">
        {constraints.map((constraint, idx) => (
          <li key={idx} className="leading-relaxed">
            <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-xs font-medium text-emerald-400">
              {constraint}
            </code>
          </li>
        ))}
      </ul>
    </div>
  )
}
*/

// 5. Main Default Problem Component
export interface ProblemProps {
  problem?: ProblemData;
}

export default function Problem({ problem = MOCK_PROBLEM }: ProblemProps) {
  return (
    <div className="flex h-full flex-col bg-zinc-900/50">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
        <ProblemHeader
          title={problem.title}
          // difficulty={problem.difficulty}
          // acceptanceRate={problem.acceptanceRate}
          tags={problem.tags}
        />

        <div className="space-y-6">
          <ProblemDescriptionText description={problem.description} />

          {/* <ProblemExamples examples={problem.examples} /> */}

          {/* <ProblemConstraints constraints={problem.constraints} /> */}
        </div>
      </div>
    </div>
  );
}
