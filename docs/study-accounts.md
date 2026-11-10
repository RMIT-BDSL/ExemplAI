# Study accounts and invite codes

How to make the accounts and invite codes for the study, what the output files hold, and how to hand them out. The script is `web/scripts/create-study-accounts.mjs`; the Convex side is `web/convex/studyAccounts.ts`.

## The three groups

| Prefix | Group | Tutor |
| --- | --- | --- |
| `P` | Pilot test (4 people) | Random, half control and half experimental |
| `C` | Students in the four tutorial classes | Control: the plain tutor |
| `E` | Students trying the app | Experimental: all features (example-based tutor) |

A participant keeps their tutor for the whole study.

## Accounts or invite codes

There are two ways to get participants in. Pick one per group.

- **Accounts.** You make the account. Each participant gets an email like `c07@socratestutor.rmit.edu.vn` and a random password like `z5wb-gzuu-mje8`. The emails aren't real mailboxes; nothing is ever sent to them. Use this when you want to control the accounts and their names.
- **Invite codes.** You make a code per participant, like `C07-AYJKVS`. The participant signs up with their own email, their own password and the code. Each code works once.

## Before you start

- Run everything from `web/`, with the project's packages installed (`pnpm install`).
- The commands below go to the **dev** deployment, the one in `web/.env.local`. To use prod, add `-- --prod` at the end.
- If anything in `web/convex/` has changed since the last deploy, deploy it first: `pnpm exec convex dev --once`. Otherwise the script fails with a list of function names.

## Making them

```bash
cd web

# Accounts
node scripts/create-study-accounts.mjs P=4 C=10 E=10

# Invite codes, one per participant
node scripts/create-study-accounts.mjs C=10 E=10 --invite-code

# More later: numbering goes on (C11, C12, ...)
node scripts/create-study-accounts.mjs C=5
```

Up to 100 per group per run. Accounts and codes are numbered separately: account `C01` and code `C01-…` aren't linked.

## The output files

Each run writes two files to `web/scripts/out/`:

| File | Holds |
| --- | --- |
| `study-accounts-<time>.md` | Accounts: name, email, password and tutor group, one table per group. For reading and printing. |
| `study-accounts-<time>.csv` | The same, one row per account, for a spreadsheet or mail merge. |
| `study-codes-<time>.md` / `.csv` | Invite codes and their tutor group. |

The file's title says which deployment it was made on (dev or prod).

A group that failed is listed under **Not created** at the end of the `.md` file. Fix the cause and run that group again.

### Keep the files safe

- **The files are the only copy of the passwords.** Convex keeps only a scrambled form (a hash) that can't be turned back into the password. If a file is lost, those accounts can't be signed into; make new ones.
- Store the files somewhere only the research team can open, such as the project's shared drive. Don't email the whole list or post it in a group chat.
- They aren't committed: git ignores `web/scripts/out/`. Don't move them anywhere else in the repo.
- The **tutor group** column is for the research team only. Don't show it to participants, so they don't know which group they're in.

## Handing them out

Give each participant only their own line, for example on a printed slip. Cut the tutor group off the slip.

### Slip for an account

> **ExemplAI sign-in**
> Go to the ExemplAI site and choose **Staff sign in**.
> Email: `c07@socratestutor.rmit.edu.vn`
> Password: `z5wb-gzuu-mje8`
> Keep this slip; you'll need it each time you sign in.

The tab is called **Staff sign in**, but participants use it too. Don't use the **Student ID** tab: it won't open these accounts.

### Slip for an invite code

> **ExemplAI sign-up**
> Go to the ExemplAI site and choose **Sign up**.
> Enter your name, your own email, a password of 8 or more characters, and this invitation code: `C07-AYJKVS`
> Next time, sign in on **Staff sign in** with your email and password.
> The code works once. Don't share it.

## Checking who's in

```bash
# Accounts and their tutor group
pnpm exec convex run studyAccounts:list
```

- Pilot accounts show no tutor group until they first open a lesson.
- Invite codes: the admin app's **Invitation codes** page shows which codes have been used. A student who signed up with a code gets their tutor group when they first open a lesson.

## Fixing problems

| Problem | What to do |
| --- | --- |
| A participant lost their password | Make them a new account (`C=1`) and stop using the old one. |
| A code says it's invalid or already used | Codes work once. Check the code on the **Invitation codes** page; make a new one (`C=1 --invite-code`) if it was used. |
| A code was given out by mistake | Invalidate it on the **Invitation codes** page. |
| The script lists function names and fails | The Convex code isn't deployed. Run `pnpm exec convex dev --once`, then run the script again. |
| The script says it couldn't create the codes | It prints how to make them by hand: on the **Invitation codes** page, one use each, then a `randomizationBlocks` row in the Convex dashboard with `cohort` set to the code and `remaining` set to `["control"]` or `["experimental"]`. Without that row, the code's student gets a random tutor. |

## Good to know

- These participants don't go through the study session (consent, surveys, quick checks, timer). That flow is only for the **Student ID** sign-in. Collect consent and surveys another way.
- `CONDITION_TOGGLE` must be unset on prod. If it's `on`, participants can switch their own tutor.
