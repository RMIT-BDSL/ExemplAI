// Parsing a cohort roster: a CSV file or IDs typed one per line.
//
// The ID column is the one whose header is "id", "student id", "student_id",
// "studentid", "student number" or "sid" (any case); without a header row,
// the first column. Other columns are kept as metadata under their header.

export type RosterRow = { studentId: string; metadata?: Record<string, string> };

const ID_HEADERS = new Set(['id', 'student id', 'student_id', 'studentid', 'student number', 'student_number', 'sid']);

/** Splits CSV text into rows, handling quoted fields with commas, quotes and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

export function parseRoster(text: string): RosterRow[] {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idCol = header.findIndex((h) => ID_HEADERS.has(h));
  const hasHeader = idCol >= 0;
  const col = hasHeader ? idCol : 0;
  const names = hasHeader ? rows[0].map((h) => h.trim()) : [];
  return rows.slice(hasHeader ? 1 : 0).flatMap((r) => {
    const studentId = (r[col] ?? '').trim();
    if (!studentId) return [];
    const metadata: Record<string, string> = {};
    r.forEach((value, i) => {
      if (i !== col && value.trim()) metadata[hasHeader ? names[i] || `column ${i + 1}` : `column ${i + 1}`] = value.trim();
    });
    return [Object.keys(metadata).length ? { studentId, metadata } : { studentId }];
  });
}
