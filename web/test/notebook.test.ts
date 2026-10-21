import { describe, expect, it } from "vitest";
import { afterReload, type Cell, programOf } from "../src/components/solve/notebook";

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
