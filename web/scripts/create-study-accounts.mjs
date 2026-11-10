#!/usr/bin/env node
// Create study accounts with random passwords and write the hand-out list.
//
//   node scripts/create-study-accounts.mjs P=4 C=10 E=10              # dev deployment (.env.local)
//   node scripts/create-study-accounts.mjs C=5 -- --prod              # 5 more control accounts, prod
//   node scripts/create-study-accounts.mjs --invite-code              # invite code, experimental, 50 uses
//   node scripts/create-study-accounts.mjs --invite-code=C --invite-uses=120
//
// P = pilot (group randomized), C = control (four tutorial classes),
// E = experimental (all features). Emails: c07@socratestutor.rmit.edu.vn.
// Accounts are numbered on from the existing ones, so re-running adds more.
// --invite-code[=P|C|E] (default E) also makes a code students sign up with;
// everyone who uses a C or E code gets that group.
// Arguments after `--` go to `convex run` (e.g. --prod, --url, --admin-key).
//
// Output: scripts/out/study-accounts-<time>.md and .csv. They hold the
// passwords and nothing else does (Convex keeps only hashes), so store them
// somewhere safe and don't commit them (scripts/out/ is git-ignored).

import { spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(webDir, "scripts", "out");
const LABELS = { P: "Pilot test", C: "Control", E: "Experimental" };
const USAGE = "Usage: node scripts/create-study-accounts.mjs [P=4] [C=10] [E=10] [--invite-code[=P|C|E]] [--invite-uses=N] [-- --prod]";

const sep = process.argv.indexOf("--");
const own = sep === -1 ? process.argv.slice(2) : process.argv.slice(2, sep);
const convexArgs = sep === -1 ? [] : process.argv.slice(sep + 1);

const fail = (msg) => {
  console.error(`${msg}\n${USAGE}`);
  process.exit(1);
};
const counts = [];
let invite = null; // the group letter
let inviteUses = 50;
for (const arg of own) {
  let m;
  if ((m = /^([PCE])=(\d+)$/i.exec(arg)) && Number(m[2]) >= 1 && Number(m[2]) <= 100) counts.push([m[1].toUpperCase(), Number(m[2])]);
  else if ((m = /^--invite-code(?:=([PCE]))?$/i.exec(arg))) invite = (m[1] ?? "E").toUpperCase();
  else if ((m = /^--invite-uses=(\d+)$/.exec(arg))) inviteUses = Number(m[1]);
  else fail(`Bad argument "${arg}".`);
}
if (counts.length === 0 && !invite) fail("Nothing to do.");

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
const mdPath = join(outDir, `study-accounts-${stamp}.md`);
const csvPath = join(outDir, `study-accounts-${stamp}.csv`);

const created = [];
const failed = [];
let inviteResult = null;

for (const [prefix, n] of counts) {
  console.log(`Creating ${n} ${LABELS[prefix]} (${prefix}) account(s) on ${target}...`);
  const out = convexRun("studyAccounts:createAccounts", { prefix, passwords: Array.from({ length: n }, password) });
  if (!out) {
    failed.push({ email: `${prefix} group`, error: "convex run failed, none created" });
    continue;
  }
  created.push(...out.created.map((a) => ({ ...a, prefix })));
  failed.push(...out.failed);
  writeFiles(); // after each group, so a later failure loses nothing
}

if (invite) {
  const code = `${invite}-${chunk(6)}`.toUpperCase();
  console.log(`Creating invite code ${code} (${LABELS[invite]}, ${inviteUses} uses) on ${target}...`);
  inviteResult = convexRun("studyAccounts:createInviteCode", { prefix: invite, code, uses: inviteUses });
  if (!inviteResult) {
    console.error(
      "Couldn't create the invite code. Make it by hand: admin app > Invitation codes (or invitationCodes:add)." +
        (invite === "P" ? "" : ` Then, to fix its group, add a randomizationBlocks row in the Convex dashboard: { cohort: "<code>", remaining: ["${invite === "C" ? "control" : "experimental"}", ...one per use] }; without it, users of the code are randomized.`),
    );
  }
}

function writeFiles() {
  const rows = created.map((a) => [LABELS[a.prefix], a.name, a.email, a.password, a.group]);
  const csv = [["account_group", "account", "email", "password", "tutor_group"], ...rows].map((r) => r.join(",")).join("\n");
  writeFileSync(csvPath, `${csv}\n`, { mode: 0o600 });

  const md = [`# ExemplAI study accounts (${target}, created ${new Date().toLocaleString()})`, ""];
  md.push("Sign in on the app's **email and password** form.", "");
  for (const p of ["P", "C", "E"]) {
    const group = created.filter((a) => a.prefix === p);
    if (group.length === 0) continue;
    md.push(`## ${LABELS[p]} (${p})`, "", "| Account | Email | Password | Tutor group |", "| --- | --- | --- | --- |");
    for (const a of group) md.push(`| ${a.name} | \`${a.email}\` | \`${a.password}\` | ${a.group} |`);
    md.push("");
  }
  if (inviteResult) {
    md.push("## Invite code", "", `\`${inviteResult.code}\`: ${inviteResult.uses} sign-ups, tutor group **${inviteResult.group}**.`);
    md.push("Students create their own account on the sign-up form with this code.", "");
  }
  if (failed.length) {
    md.push("## Not created", "");
    for (const f of failed) md.push(`- ${f.email}: ${f.error}`);
    md.push("");
  }
  writeFileSync(mdPath, md.join("\n"), { mode: 0o600 });
}

writeFiles();
console.log(`\nCreated ${created.length} account(s).${inviteResult ? ` Invite code: ${inviteResult.code}` : ""}`);
if (failed.length) console.error(`Failed: ${failed.map((f) => `${f.email} (${f.error})`).join("; ")}`);
console.log(`Hand-out list: ${mdPath}\nCSV:           ${csvPath}`);
process.exit(failed.length || (invite && !inviteResult) ? 1 : 0);
