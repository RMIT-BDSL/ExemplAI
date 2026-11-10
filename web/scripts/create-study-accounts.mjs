#!/usr/bin/env node
// Create study accounts with random passwords, or invite codes, and write the hand-out list.
//
//   node scripts/create-study-accounts.mjs P=4 C=10 E=10                # accounts, dev deployment (.env.local)
//   node scripts/create-study-accounts.mjs C=10 E=10 --invite-code      # single-use codes C01-XXXXXX ... instead
//   node scripts/create-study-accounts.mjs C=5 -- --prod                # 5 more control accounts, prod
//
// P = pilot (group randomized, balanced), C = control (four tutorial
// classes), E = experimental (all features).
// Accounts: c07@socratestutor.rmit.edu.vn + random password.
// --invite-code: one single-use code per number instead (C07-X7KM9Q), fixed
// to its group; the student signs up with their own email.
// Numbering goes on from the existing ones, so re-running adds more.
// Arguments after `--` go to `convex run` (e.g. --prod, --url, --admin-key).
// After changing web/convex/, deploy first: pnpm exec convex dev --once.
//
// Output: scripts/out/study-accounts-<time>.md and .csv (or study-codes-*).
// They hold the passwords and nothing else does (Convex keeps only hashes),
// so store them somewhere safe and don't commit them (scripts/out/ is git-ignored).

import { spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(webDir, "scripts", "out");
const LABELS = { P: "Pilot test", C: "Control", E: "Experimental" };
const USAGE = "Usage: node scripts/create-study-accounts.mjs P=4 C=10 E=10 [--invite-code] [-- --prod]";

const sep = process.argv.indexOf("--");
const own = sep === -1 ? process.argv.slice(2) : process.argv.slice(2, sep);
const convexArgs = sep === -1 ? [] : process.argv.slice(sep + 1);

const fail = (msg) => {
  console.error(`${msg}\n${USAGE}`);
  process.exit(1);
};
const counts = [];
let codes = false;
for (const arg of own) {
  const m = /^([PCE])=(\d+)$/i.exec(arg);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 100) counts.push([m[1].toUpperCase(), Number(m[2])]);
  else if (arg === "--invite-code") codes = true;
  else fail(`Bad argument "${arg}".`);
}
if (counts.length === 0) fail("Say how many, e.g. C=10.");

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i
const chunk = (n) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
// 12 characters, about 59 bits, easy to type.
const password = () => [chunk(4), chunk(4), chunk(4)].join("-");

const target = convexArgs.includes("--prod") ? "prod" : "dev";
function convexRun(fn, args) {
  const res = spawnSync("pnpm", ["exec", "convex", "run", fn, JSON.stringify(args), ...convexArgs], {
    cwd: webDir, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
  });
  if (res.status !== 0) return null;
  return JSON.parse(res.stdout.slice(res.stdout.search(/[[{]/)));
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
mkdirSync(outDir, { recursive: true });
const base = join(outDir, `${codes ? "study-codes" : "study-accounts"}-${stamp}`);
const mdPath = `${base}.md`;
const csvPath = `${base}.csv`;

const created = [];
const failed = [];

for (const [prefix, n] of counts) {
  console.log(`Creating ${n} ${LABELS[prefix]} (${prefix}) ${codes ? "invite code" : "account"}(s) on ${target}...`);
  if (codes) {
    const out = convexRun("studyAccounts:createInviteCodes", { prefix, suffixes: Array.from({ length: n }, () => chunk(6).toUpperCase()) });
    if (out) created.push(...out.map((c) => ({ ...c, prefix })));
    else {
      failed.push({ what: `${prefix} codes`, error: "convex run failed, none created" });
      console.error(
        `Make the ${prefix} codes by hand instead: admin app > Invitation codes, one use each. To fix a code's group, ` +
          `add a randomizationBlocks row in the Convex dashboard: { cohort: "<code>", remaining: ["control" or "experimental"] }.`,
      );
    }
  } else {
    const out = convexRun("studyAccounts:createAccounts", { prefix, passwords: Array.from({ length: n }, password) });
    if (out) {
      created.push(...out.created.map((a) => ({ ...a, prefix })));
      failed.push(...out.failed.map((f) => ({ what: f.email, error: f.error })));
    } else failed.push({ what: `${prefix} accounts`, error: "convex run failed, none created" });
  }
  writeFiles(); // after each group, so a later failure loses nothing
}

function writeFiles() {
  const header = codes ? ["account_group", "invite_code", "tutor_group"] : ["account_group", "account", "email", "password", "tutor_group"];
  const rows = created.map((a) => (codes ? [LABELS[a.prefix], a.code, a.group] : [LABELS[a.prefix], a.name, a.email, a.password, a.group]));
  writeFileSync(csvPath, `${[header, ...rows].map((r) => r.join(",")).join("\n")}\n`, { mode: 0o600 });

  const md = [`# ExemplAI study ${codes ? "invite codes" : "accounts"} (${target}, created ${new Date().toLocaleString()})`, ""];
  md.push(
    codes
      ? "Each code is for one student: they sign up on the app's sign-up form with their own email and the code."
      : "Sign in on the app's **email and password** form.",
    "",
  );
  for (const p of ["P", "C", "E"]) {
    const group = created.filter((a) => a.prefix === p);
    if (group.length === 0) continue;
    md.push(`## ${LABELS[p]} (${p})`, "");
    if (codes) {
      md.push("| Invite code | Tutor group |", "| --- | --- |");
      for (const a of group) md.push(`| \`${a.code}\` | ${a.group} |`);
    } else {
      md.push("| Account | Email | Password | Tutor group |", "| --- | --- | --- | --- |");
      for (const a of group) md.push(`| ${a.name} | \`${a.email}\` | \`${a.password}\` | ${a.group} |`);
    }
    md.push("");
  }
  if (failed.length) {
    md.push("## Not created", "");
    for (const f of failed) md.push(`- ${f.what}: ${f.error}`);
    md.push("");
  }
  writeFileSync(mdPath, md.join("\n"), { mode: 0o600 });
}

writeFiles();
console.log(`\nCreated ${created.length} ${codes ? "invite code" : "account"}(s).`);
if (failed.length) console.error(`Failed: ${failed.map((f) => `${f.what} (${f.error})`).join("; ")}`);
console.log(`Hand-out list: ${mdPath}\nCSV:           ${csvPath}`);
process.exit(failed.length ? 1 : 0);
