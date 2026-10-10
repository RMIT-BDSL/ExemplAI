# High-level List of Stuff To Do

_Last updated 2026-10-07. Status: testing on dev; each student gets a random, fixed group (#97), with a testing toggle where `CONDITION_TOGGLE=on`._

## Course and design (decided)

* **Course:** Python Programming Bootcamp (COSC3104/5), CC is Tuan-Anh, run both SGS and HN for Viet-3.

* **Syllabus weeks = BKT topics** (`knowledge_component`), one parameter set each in `data/bktParams.json`:
  1. Introduction & Environment Setup (`intro_setup`)
  2. Variables and Expressions (`variables_expressions`)
  3. String and Formatting (`strings_formatting`)
  4. Branching (`branching`)
  5. Loops (`loops`)
  6. Advanced Loops (`advanced_loops`)
  7. Functions (`functions`)
  8. Collections (`collections`)
  9. File (`files`)
  10. No class; Christmas Break
  11. Basic Libraries for Practical Tasks (`basic_libraries`)
  12. Advanced Topics (`advanced_topics`)

* **Don't teach beyond what's been covered:** examples may only use the Python features of the lesson's topic and earlier topics (`server/ai/syllabus.py`). Control tutor is generic (no limit).

* **BKT:** hand-set parameters (prior 0.15, learn 0.20, guess 0.4, slip 0.1) pending a refit on pilot data — the CSEDM 2019 data (86 students) could not estimate a learn rate. Only the first Submit per lesson updates mastery; `mastered` is set at 0.95. `data/fit_bkt_baseline.py` writes `bktParams.fitted.json` for review.

* **Help flow (experimental group):** chat locked until a failed Submit → **Get help** (first example) → chat → **New example** (each further failed Submit earns one, max 3 per lesson; resets after opening another lesson). Complete / Faded / Erroneous chosen by mastery band. No agent asks students to explain anything — passing code is the measure.

* **Control group:** plain chat with the same LLM, ask anything; Dean checks answer leaks, unsafe content and broken code only.

## Now (testing on dev)

* [ ] Redeploy the Python server on Railway from `dev` (confirm which branch Railway tracks); #86 needs it (Dean retry, progress steps, timing logs). Server and Convex must share `CONVEX_BACKEND_SECRET` or Run/Submit results stop being recorded.
* [ ] Reset + reseed the dev Convex database (`pnpm run seed` after clearing the tables), then run `students:backfillSummaries` for the admin student view.
* [ ] Reseed dev and production with the 9 new hidden tests (2026-10-10): a mutation check found wrong solutions passing every test in 8 lessons (convertToDegrees, nearestWaterFountain, makeChange, countNotes, compoundInterest, describeTemperature, mostCommonWord, findRoot); now 137 hidden tests, and every remaining surviving change gives the same answers.
* [ ] Review `server/ai/syllabus.py` (features and bug types per topic) against the course guide.
* [ ] Manual test of the full flow on exemplai-dev: failed Submit → Get help (wait lines) → type just the missing piece ("Exactly right!") → two wrong guesses (hint, then how to work it out) → ask for another example in chat (pointed to the New example button) → New example ×3 → "try another topic" → reset. Also check: one tutor bar (#88), Submit history, Run shortcut, resizable columns, console, syllabus opening on the current week.
* [ ] Check the admin student view (#78, #83) gives what testing needs (lesson, topic, mastery + band, status, examples used, last reply type).

## Before the pilot

* [x] Wait messages while an example is written (#112): Get help and New example show "Reading your submission", "Evaluating any errors", "Building an example", "Checking my work", "Pretty printing", a new line about every 3 s or sooner on a server step (`web/src/lib/waitMessages.ts`); typed replies keep the old progress rows.

* [x] Store each student's A/B group in Convex (#97: blocked randomization per invite code; testing toggle behind `CONDITION_TOGGLE=on`, leave unset in production).
* [ ] Later: Dean enforces `<allowed_python>` (currently an agent instruction only). Faded examples still use week-4 `if` in a few week-2 lessons (2 of 42 on 2026-10-08), mostly rounding-up lessons; a code check could send the draft back. Acceptable for now (2026-10-09).
* [x] Faded, week 2: a mistake in how one expression is written (missing brackets, `/` for `//`, `int()` too early) now keeps that expression on one line, blanked, instead of splitting it into steps. Blind review of 42 old vs 42 new week-2 examples (2026-10-09): aims at the student's mistake 29 → 37, mean score 3.79 → 4.29.
* [ ] Later: Faded follow-ups to a wrong answer hint so strongly that they nearly give it away in 6 of 34 cases (mostly week-3 string reorders). Acceptable for now (2026-10-09).
* [x] Follow-up reply time (2026-10-09): one at a time, a typed answer takes 2.9 s median (5.3 s p90): guardrail 0.5 s, tutor 1.3 s (28 reasoning tokens), Dean 0.8 s. The ~10 s seen in testing came from 6 requests at once plus Dean retries; a correct answer still gets a retry 4 times in 16 (+2–3 s each).
* [x] Dean on Faded follow-ups after two wrong tries (2026-10-08): the Dean now gets the current example in full and the student's message count since it, worked out in code. "Here's how to work it out" replies replaced: 17/68 → 3/68; typed replies replaced overall 21/136 → 7/136 (`eval.examples --replies`). Typed chat never starts a new example (new examples only from the buttons).
* [ ] Guardrail: the injection pattern misses "ignore **all previous** instructions" (allows only one word between "ignore" and "instructions"); typed messages are still screened by the model.
* [ ] Prompt review items 9–14: runnable Complete/Faded code, no repeated scenarios, scripted reply to "what's wrong with my code?", "in the editor" wording, shared length/style rules, clearer "trivially adaptable" rule.
* [x] Empirical runs of the prompts on scripted conversations: `server/eval` (examples, typed replies and answers, simulated sessions).
* [ ] Teaching team reviews the new lessons (tag `exemplai`) and the reconstructed CSEDM descriptions (check against PSLC DataShop dataset 1798).

## Research analysis

* [ ] Log mastery at the time with each reply (already logged: delivered type, Dean decision/reason, rejected drafts, the group on each chat, PostHog help clicks, and mastery before each lesson's first Submit).
* [x] Log every Run and Submit (`codeAttempts`: code snapshot, outcome, test counts, group, mastery before/after the graded Submit, app version).
* [ ] Consent before open semester use: consent screen at first login; store `consent_at`, `consent_version` and `data_opt_out` on `users`.
* [ ] Study code per student (for survey forms and a de-identified research export), then the export itself (ProgSnap2-style CSVs).
* [ ] Ethics check: Sentry (IPs, headers) and PostHog events vs. the approval (#2025-29047-30387).

**PostHog (usage analytics only; research data is in Convex):**
* [ ] Identify students by Convex user id (later the study code), not email and name (`posthog.identify` in `SignUpForm.tsx`, `SignInForm.tsx`, `_authenticated.tsx`); stop sending email as a property on `magic_link_requested` and `invitation_code_submitted`.
* [ ] Label every event with the student's group, cohort (invite code) and app version (`posthog.register` once the group is known).
* [ ] `code_submitted`: `success` only means the code ran without an error; add `tests_passed` / `tests_total` (or rename it).
* [ ] Check whether session replay is on in the PostHog dashboard (it records students' screens).
* [ ] Remove the server's unused PostHog setup (`POSTHOG_*` settings, `posthog` dependency); group assignment no longer uses the PostHog flag (#97). Archive the `new-model-test` flag.

## Before going live

* [ ] Investigate the failed production deploy.
* [ ] Fix the Convex test setup (betterAuth not registered in `convexTest`), then re-enable lint and tests in the production deploy.
* [ ] Security: restrict CORS to our origins. (Students can no longer forge lesson results: `recordCodeExecution` needs the backend secret.)
* [ ] Check whether the tutor graph still needs the Postgres checkpointer (`DATABASE_URL`, `server/ai/checkpointer.py`): each request rebuilds the conversation, group, mastery and example allowance from Convex, so the checkpoint may only duplicate Convex. Confirm no state field carries over between turns, then switch to an in-memory checkpointer and drop Postgres.
* [ ] Remove unused services: Supabase (`server/repository.py`, `SUPABASE_*` settings; nothing imports it) and Langfuse (`LANGFUSE_*` settings; never wired up).
* [x] Check response times (#107, [testing outcome](docs/evaluation/2026-10-07-model-latency.md)): Get help went from 38 s median / 79 s p95 to 3.5 s / 8.8 s with V4.1 Flash writing and gpt-oss-120b checking. Confirmed faster on dev.

**Follow-ups from the model evaluation:**
* [ ] Production timings from the Railway logs (`step <node>: <ms> ms`, `chat total`), to report next to the laptop measurements in the paper; the startup line `llm — agent=… check=…` confirms the models in use.
* [ ] Blind review pack for an instructor: examples from each setup side by side, setup names hidden (the evaluation's quality checks were automatic only).
* [ ] About 6% of examples use Python from a later week (e.g. `if` in a week 2–3 example), whatever the model: tighten the example prompts' `<allowed_python>` instructions or have the Dean check it. Some lessons need it themselves (#104).
* [ ] The gpt-oss-120b guardrail let 1 of 4 prompt injections through ("Ignore all previous instructions…"); the tutor still refused. Add the pattern to the guardrail's rule check.
* [ ] Railway puts the server to sleep when idle; the first request after a quiet period waits for a cold start (not in the measured times). Turn sleep off for pilot sessions if it shows.
* [ ] Merge `dev` → `main`, set `OPENROUTER_API_KEY` in production, reseed production.
* [ ] Staff pilot (also provides data for the BKT refit).

## Future

* [ ] Lessons for Files (week 9, none yet), Basic Libraries (week 11, 2 lessons) and Advanced Topics (week 12, none yet); weeks 1–8 have ≥ 7 each.
* [ ] Keep solution code and hidden tests out of the browser; grade with the lesson from Convex (closes the fake-solution loophole).
* [x] Add 1–2 hidden edge-case tests per lesson (#96).
* [ ] Pre/post tests in the app: assessment lessons with the tutor turned off, graded and logged like any Submit (RQ1).
* [ ] Study code per student, entered on the external survey forms (Paas, NASA-TLX, demographics), so form answers can be linked to the trace.
* [ ] Research export: de-identified, analysis-ready tables (one row per attempt, message, visit and student; ProgSnap2-style) from Convex, reusing the eval analysis code.
* [ ] "Check my fix" button that runs a student's Erroneous fix against tests.
* [ ] Wish list: adaptive fading within a lesson (Salden, Aleven, Schwonke & Renkl 2010). A later Faded example fades a little more if the student completed the earlier blanks, and no more if they needed the answer shown. Tried as a prompt rule on 2026-10-07 and dropped (not needed for the study); the server could pass the fading level instead of leaving it to the prompt.
* [ ] Decide: should mastery unlock the next topic? Trial scope (which weeks)? Fold week 1 into week 2?
