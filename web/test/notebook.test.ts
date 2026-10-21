import { describe, expect, it } from "vitest";
import {
  afterReload,
  type Cell,
  gradedProgram,
  programOf,
  solutionSeed,
} from "../src/components/solve/notebook";

const cells: Cell[] = [
  { id: "a", type: "code", source: "def add(a, b):\n    return a + b\n\n" },
  { id: "n", type: "markdown", source: "# Why?\nnot code" },
  { id: "b", type: "code", source: "   \n" },
  { id: "c", type: "code", source: "print(add(1, 2))" },
];

describe("programOf", () => {
  it("joins the code cells in order, leaving out markdown and empty cells", () => {
    expect(programOf(cells)).toBe("def add(a, b):\n    return a + b\n\nprint(add(1, 2))");
  });

  it("stops at the cell being run", () => {
    expect(programOf(cells, "a")).toBe("def add(a, b):\n    return a + b");
    expect(programOf(cells, "n")).toBe("def add(a, b):\n    return a + b");
  });
});

describe("afterReload", () => {
  it("marks a reply that was still being waited for as lost", () => {
    const [cell] = afterReload([
      { id: "q", type: "markdown", source: "?", output: { kind: "tutor", at: 1, question: "?", status: "waiting" } },
    ]);
    expect(cell.output).toMatchObject({ status: "error" });
  });
});

describe("solution cells", () => {
  const withSolutions: Cell[] = [
    ...cells,
    { id: "s1", type: "code", source: "def add(a, b):\n    return 0\n", solution: true },
    { id: "s2", type: "code", source: "def add(a, b):\n    return a + b\n", solution: true },
    { id: "p", type: "code", source: "print('scratch')" },
  ];

  it("grades the newest solution cell on its own", () => {
    expect(gradedProgram(withSolutions)).toBe("def add(a, b):\n    return a + b");
  });

  it("grades all the code cells while there is no solution cell", () => {
    expect(gradedProgram(cells)).toBe(programOf(cells));
  });

  it("starts a new solution from the newest one, else the last Submit, else the starter", () => {
    const submit = { at: 1, code: "submitted", passed: 0, total: 1, outcome: "failed" as const };
    expect(solutionSeed(withSolutions, submit, "starter")).toBe("def add(a, b):\n    return a + b\n");
    expect(solutionSeed(cells, submit, "starter")).toBe("submitted");
    expect(solutionSeed(cells, null, "starter")).toBe("starter");
  });
});
