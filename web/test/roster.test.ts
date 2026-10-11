import { describe, expect, it } from "vitest";
import { parseCsv, parseRoster } from "../../admin/src/lib/roster";

describe("roster parsing", () => {
  it("takes typed IDs one per line", () => {
    expect(parseRoster("s3912345\n\ns3912346\r\n")).toEqual([{ studentId: "s3912345" }, { studentId: "s3912346" }]);
  });

  it("finds the ID column by its header and keeps the other columns", () => {
    const csv = "Name,Student ID,Class\nAn Nguyen,s3912345,Tue 9am\n\"Lee, Bo\",s3912346,\n";
    expect(parseRoster(csv)).toEqual([
      { studentId: "s3912345", metadata: { Name: "An Nguyen", Class: "Tue 9am" } },
      { studentId: "s3912346", metadata: { Name: "Lee, Bo" } },
    ]);
  });

  it("uses the first column when there is no ID header", () => {
    expect(parseRoster("s1,extra\ns2,more")).toEqual([
      { studentId: "s1", metadata: { "column 2": "extra" } },
      { studentId: "s2", metadata: { "column 2": "more" } },
    ]);
  });

  it("handles quotes, escaped quotes and a byte-order mark", () => {
    expect(parseCsv('"a ""b""",c\n')).toEqual([['a "b"', "c"]]);
    expect(parseRoster("﻿id\ns9")).toEqual([{ studentId: "s9" }]);
  });
});
