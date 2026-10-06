# High-level List of Stuff To Do

_Last updated 2026-10-05. Status: testing on dev; everyone is routed to the experimental group on purpose._

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
* [ ] Review and merge #88 (one tutor bar: Get help → chat).
* [ ] Review `server/ai/syllabus.py` (features and bug types per topic) against the course guide.
* [ ] Manual test of the full flow on exemplai-dev: failed Submit → Get help → chat → New example ×3 → "try another topic" → reset. Also check what's new since 10-03: Dean retry, progress steps, fresh chat per lesson open, Submit history, Run shortcut, resizable columns, console, syllabus opening on the current week.
* [ ] Check the admin student view (#78, #83) gives what testing needs (lesson, topic, mastery + band, status, examples used, last reply type).

## Before the pilot

* [ ] Store each student's A/B group in Convex (#97: blocked randomization per invite code; testing toggle behind `CONDITION_TOGGLE=on`, leave unset in production).
* [ ] Dean enforces `<allowed_python>` (currently an agent instruction only).
* [ ] Guardrail: the injection pattern misses "ignore **all previous** instructions" (allows only one word between "ignore" and "instructions"); typed messages are still screened by the model.
* [ ] Prompt review items 9–14: runnable Complete/Faded code, no repeated scenarios, scripted reply to "what's wrong with my code?", "in the editor" wording, shared length/style rules, clearer "trivially adaptable" rule.
* [ ] Empirical DeepSeek runs of the prompts on scripted conversations (needs an OpenRouter key in `server/.env`).
* [ ] Teaching team reviews the new lessons (tag `exemplai`) and the reconstructed CSEDM descriptions (check against PSLC DataShop dataset 1798).

## Research analysis

* [ ] Log mastery at the time, group and rejected drafts with each reply (already logged: delivered type, Dean decision/reason, PostHog help clicks, and mastery before each lesson's first Submit).
* [x] Log every Run and Submit (`codeAttempts`: code snapshot, outcome, test counts, group, mastery before/after the graded Submit, app version).
* [ ] Consent before open semester use: consent screen at first login; store `consent_at`, `consent_version` and `data_opt_out` on `users`; ethics amendment for semester-long data collection.
* [ ] Study code per student (for survey forms and a de-identified research export), then the export itself (ProgSnap2-style CSVs).
* [ ] Ethics check: Sentry (IPs, headers) and PostHog events vs. the approval (#2025-29047-30387).

## Before going live

* [ ] Investigate the failed production deploy.
* [ ] Fix the Convex test setup (betterAuth not registered in `convexTest`), then re-enable lint and tests in the production deploy.
* [ ] Security: restrict CORS to our origins. (Students can no longer forge lesson results: `recordCodeExecution` needs the backend secret.)
* [ ] Check response times on dev from the server's timing logs (`step <node>: <ms> ms`, `chat total`); browser times out at 60 s. Buttons already skip the guardrail's model check.
* [ ] Merge `dev` → `main`, set `OPENROUTER_API_KEY` in production, reseed production.
* [ ] Staff pilot (also provides data for the BKT refit).

## Future

* [ ] Lessons for Files (week 9, none yet), Basic Libraries (week 11, 2 lessons) and Advanced Topics (week 12, none yet); weeks 1–8 have ≥ 7 each.
* [ ] Keep solution code and hidden tests out of the browser; grade with the lesson from Convex (closes the fake-solution loophole).
* [x] Add 1–2 hidden edge-case tests per lesson (#96).
* [ ] "Check my fix" button that runs a student's Erroneous fix against tests.
* [ ] Decide: should mastery unlock the next topic? Trial scope (which weeks)? Fold week 1 into week 2?
