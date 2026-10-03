# High-level List of Stuff To Do

_Last updated 2026-10-03. Status: testing on dev; everyone is routed to the experimental group on purpose

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

* [ ] Redeploy the Python server on Railway from `dev` (confirm which branch Railway tracks).
* [ ] Reset + reseed the dev Convex database (`pnpm run seed` after clearing the tables).
* [ ] Review `server/ai/syllabus.py` (features and bug types per topic) against the course guide.
* [ ] Manual test of the full flow: failed Submit → Get help → chat → New example ×3 → "try another topic" → reset.
* [ ] Testing view: small admin-only panel (lesson, topic, mastery + band, status, examples used, last reply type).

## Before the pilot

* [ ] Store each student's A/B group in Convex (needed for the control group's plain chat UI and lock).
* [ ] Dean enforces `<allowed_python>` (currently an agent instruction only).
* [ ] Prompt review items 9–14: runnable Complete/Faded code, no repeated scenarios, scripted reply to "what's wrong with my code?", "in the editor" wording, shared length/style rules, clearer "trivially adaptable" rule.
* [ ] Empirical DeepSeek runs of the prompts on scripted conversations (needs an OpenRouter key in `server/.env`).
* [ ] Teaching team reviews the new lessons (tag `exemplai`) and the reconstructed CSEDM descriptions (check against PSLC DataShop dataset 1798).

## Research analysis

* [ ] Log mastery at the time, group, Dean decision/reason and rejected drafts with each reply (delivered type and PostHog help clicks are already logged).
* [ ] Dean retries once before the generic fallback.
* [ ] Ethics check: Sentry (IPs, headers) and PostHog events vs. the approval (#2025-29047-30387).

## Before going live

* [ ] Investigate the failed production deploy.
* [ ] Fix the Convex test setup (betterAuth not registered in `convexTest`), then re-enable lint and tests in the production deploy.
* [ ] Security: restrict CORS to our origins; stop students writing their own mastery / failed-Submit counts (`recordCodeExecution`).
* [ ] Check response times (guardrail + agent + Dean; browser times out at 60 s).
* [ ] Merge `dev` → `main`, set `OPENROUTER_API_KEY` in production, reseed production.
* [ ] Staff pilot (also provides data for the BKT refit).

## Future

* [ ] Lessons for Files (week 9, none yet), Basic Libraries (week 11, 2 lessons) and Advanced Topics (week 12, none yet); weeks 1–8 have ≥ 7 each.
* [ ] Keep solution code and hidden tests out of the browser; grade with the lesson from Convex (closes the fake-solution loophole).
* [ ] Add 1–2 hidden edge-case tests per lesson.
* [ ] "Check my fix" button that runs a student's Erroneous fix against tests.
* [ ] Decide: should mastery unlock the next topic? Trial scope (which weeks)? Fold week 1 into week 2?
