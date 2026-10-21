// The Solve notebook's cells, shared by the route and its components. Saved
// per student and lesson in Convex (convex/solveNotebooks.ts).

export type CellType = "code" | "markdown";

/** What a code cell printed the last time it ran (cells above it ran first). */
export interface RunOutput {
  kind: "run";
  at: number;
  /** The cell as it ran, and as it was the run before: "what changed". */
  source: string;
  prev_source?: string;
  call?: string;
  stdout?: string;
  return_value?: string;
  error?: string;
}

/** A markdown cell sent to the tutor, and the reply. */
export interface TutorOutput {
  kind: "tutor";
  at: number;
  question: string;
  status: "waiting" | "done" | "locked" | "error";
  reply?: string;
  reply_type?: string;
  /** Why it wasn't sent (locked) or what went wrong (error). */
  note?: string;
  /** The student's turn in chatMessages, to find the reply. */
  message_id?: string;
}

export interface Cell {
  id: string;
  type: CellType;
  source: string;
  output?: RunOutput | TutorOutput;
  /**
   * A solution cell: the student's answer, which Submit grades on its own.
   * Each new one starts from the last, so earlier ones stay as a record; they
   * can't be deleted or turned into markdown.
   */
  solution?: boolean;
}

/** The last Submit: the whole program, graded. */
export interface SubmitOutput {
  at: number;
  code: string;
  prev_code?: string;
  passed: number;
  total: number;
  outcome: "passed" | "failed" | "error";
  error?: string;
}

export function newCellId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * The program the code cells make, in order: what Submit grades. With `upTo`,
 * only the code cells up to that one, which is what running it executes (so a
 * cell sees what the cells above it defined, as in a notebook).
 */
export function programOf(cells: Cell[], upTo?: string) {
  const parts: string[] = [];
  for (const cell of cells) {
    if (cell.type === "code" && cell.source.trim()) parts.push(cell.source.replace(/\s+$/, ""));
    if (cell.id === upTo) break;
  }
  return parts.join("\n\n");
}

/** The newest solution cell (the last one in the notebook), if there is one. */
export function latestSolution(cells: Cell[]) {
  for (let i = cells.length - 1; i >= 0; i--) if (cells[i].solution) return cells[i];
  return undefined;
}

/** What Submit grades: the newest solution cell, else all the code cells. */
export function gradedProgram(cells: Cell[]) {
  const solution = latestSolution(cells);
  return solution ? solution.source.replace(/\s+$/, "") : programOf(cells);
}

/**
 * What a new solution cell starts from: the newest solution cell, else the
 * code last submitted, else the starter code.
 */
export function solutionSeed(cells: Cell[], submit: SubmitOutput | null, starter: string) {
  return latestSolution(cells)?.source ?? submit?.code ?? starter;
}

/** A saved notebook with replies that can no longer arrive marked as lost. */
export function afterReload(cells: Cell[]): Cell[] {
  return cells.map((cell) =>
    cell.output?.kind === "tutor" && cell.output.status === "waiting"
      ? {
          ...cell,
          output: { ...cell.output, status: "error", note: "The page closed before the reply arrived. Ask again." },
        }
      : cell,
  );
}
