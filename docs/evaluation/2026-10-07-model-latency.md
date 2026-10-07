# Testing outcome: tutor model, provider and reasoning settings

**Date:** 7 October 2026 · **Harness:** `server/eval/` (commit `851446a`, PR #107) · **Raw data:** [`2026-10-07-data/`](2026-10-07-data/) · **Spend:** US$1.97 on OpenRouter

## Summary

Students waited a long time for tutor replies: a **Get help** reply took a **median of 38 s and a 95th percentile of 79 s** (worst 126 s), and a quarter of replies took over a minute. We compared eight model setups by running the real tutor graph on the course's lessons.

**Adopted setup:** DeepSeek V4.1 Flash writes the replies and gpt-oss-120b runs the input guardrail and the Dean (the answer-leak validator), both with reasoning effort `low`, routed to OpenRouter's fastest providers.

| | Before (production) | After (adopted) |
|---|---|---|
| Get help round trip, median | 38.1 s | **3.5 s** |
| Get help round trip, 95th percentile | 79.0 s | **8.8 s** |
| Replies over 60 s | 25% | **0%** |
| Dean accuracy on 60 planted drafts | 100% | **100%** |

Most of the gain came from **how the model was called**, not from the model itself. OpenRouter's default routing favours the cheapest providers, which were also the slowest, and the previous model reasoned at length (about 1,000 tokens) before every answer.

## Method

### System under test

Each tutor reply runs a LangGraph pipeline with one model call per step, in sequence:

1. **Input guardrail:** screens typed messages (button presses skip it).
2. **Example agent:** writes a Complete, Faded or Erroneous worked example, chosen by the student's BKT mastery (< 0.3, 0.3–0.7, > 0.7). In the control group, a plain tutor agent replies instead.
3. **Dean:** approves the draft or rejects it (answer leak, wrong example type, broken code, inappropriate content). A rejected draft goes back to the agent once; a second rejection sends a fallback message instead of an example.

The harness runs the real graph offline, without the database or browser, with the same inputs the server would send: the lesson, a realistic failed-Submit summary, the student's mastery and the conversation so far.

### Setups compared

| ID | Writes (agent) | Checks (guardrail + Dean) | Reasoning effort (agent / checks) | Provider routing |
|---|---|---|---|---|
| A | DeepSeek V4 Flash 0731 | same | model default / default | OpenRouter default (cheapest first) |
| B | DeepSeek V4.1 Flash | same | low / low | fastest first |
| C | DeepSeek V4.1 Flash | same | low / none | fastest first |
| D | DeepSeek V4.1 Flash | same | none / none | fastest first |
| E | DeepSeek V4.1 Flash | same | medium / low | fastest first |
| **F** | **DeepSeek V4.1 Flash** | **gpt-oss-120b** | **low / low** | **fastest first** |
| G | Gemini 3.8 Flash | same | low / low | fastest first |
| H | Claude Haiku 4.5 | same | none / none | fastest first |

Setup A is the configuration production used before this test. Haiku ran without reasoning, because Anthropic's extended thinking requires a budget of at least 1,024 tokens.

### Phases

1. **Speed:** Get help on 4 lessons (weeks 2, 4, 5 and 7) × 3 example types × 3 repeats = **36 replies per setup**, run one at a time with setups interleaved, so that changing provider load affects all setups alike.
2. **Quality:** 16 lessons (2 per week, weeks 1–8) × 4 replies per setup = **64 replies per setup**, 4 at a time. The 4 replies were: Get help, then New example, then a typed message (rotating through a follow-up question, "just give me the solution", "fix my code" with the code pasted, and a prompt injection), plus a control-group question.
3. **Dean accuracy:** **60 planted drafts per setup**, built from clean examples produced in phase 2: the clean example (should pass); the same example with its code replaced by the lesson's solution (leak); a reply that hands the student corrected code; a Complete example presented as Faded (wrong type); and an example with broken code.

### Measures

- **Round-trip time:** from sending the request to receiving the final, Dean-approved reply, including any retry. The time of each step is also recorded.
- **Leak test (automatic):** every function in the reply's code is renamed to the lesson's function and run against the lesson's own visible and hidden tests. Passing them all counts as a leak.
- **Syllabus check:** the code is scanned for Python taught after the lesson's week (e.g. loops in week 2, lists before week 8, imports before week 11).
- **Structure:** a new example contains code; Faded examples contain blanks; the code parses.
- **Quoting student code:** the reply repeats a line of the student's code (the tutor must never work on the student's code).
- **Fallback rate:** both drafts rejected by the Dean.
- **Dean accuracy:** the share of planted drafts judged correctly.
- **Tokens:** input, output and reasoning tokens of every model call.

## Results

### Round-trip time: Get help (phase 1, 36 replies per setup, one at a time)

| Setup | Median | p90 | p95 | Worst | > 15 s | > 60 s |
|---|---|---|---|---|---|---|
| A: production (V4 Flash 0731, defaults) | 38.1 s | 65.6 s | 79.0 s | 126.4 s | 97% | 25% |
| D: V4.1, none / none | 2.4 s | 8.9 s | 11.4 s | 15.1 s | 3% | 0% |
| **F: V4.1 / gpt-oss-120b, low / low** | **3.5 s** | **8.1 s** | **8.8 s** | **15.6 s** | **3%** | **0%** |
| C: V4.1, low / none | 4.4 s | 7.9 s | 10.1 s | 15.9 s | 3% | 0% |
| H: Haiku 4.5, none / none | 5.1 s | 10.3 s | 10.8 s | 11.4 s | 0% | 0% |
| E: V4.1, medium / low | 5.1 s | 10.2 s | 11.7 s | 15.3 s | 3% | 0% |
| B: V4.1, low / low | 5.4 s | 11.3 s | 15.6 s | 18.9 s | 8% | 0% |
| G: Gemini 3.8 Flash, low / low | 6.7 s | 10.7 s | 12.2 s | 15.8 s | 3% | 0% |

Median round trip by example type, production (A) against adopted (F): Complete 31.3 s → 3.5 s, Faded 38.0 s → 4.5 s, Erroneous 59.4 s → 2.5 s.

### Example generation alone (the agent's first draft, phase 1)

| Setup | Median | p95 | Worst | Reasoning tokens (median) | Output speed (tokens/s) |
|---|---|---|---|---|---|
| A: production | 29.2 s | 59.2 s | 81.8 s | 1,022 | 36 |
| D: V4.1 none | 1.4 s | 3.4 s | 14.0 s | 0 | 193 |
| F: V4.1 low | 2.7 s | 8.2 s | 14.8 s | 438 | 238 |
| B: V4.1 low | 3.0 s | 7.8 s | 8.2 s | 480 | 258 |
| C: V4.1 low | 3.1 s | 6.7 s | 9.1 s | 476 | 248 |
| H: Haiku 4.5 none | 3.1 s | 5.2 s | 6.1 s | 0 | 90 |
| G: Gemini 3.8 Flash low | 3.6 s | 10.4 s | 13.6 s | 0 reported | 70 |

Example generation is 58–83% of a reply's round trip. V4.1 Flash on `low` still reasons for about 480 tokens (roughly 2 s). The visible example is about the same length with or without reasoning.

### All scenarios, with quality (phase 2, 64 replies per setup)

| Setup | Median | p95 | Fallback | Leaks | Syllabus flags (examples) | Notable behaviour |
|---|---|---|---|---|---|---|
| A: production | 45.7 s | 104.4 s | 0% | 0 | 9% | Too slow |
| D: V4.1 none / none | 2.6 s | 5.4 s | 8% | 2 | 6% | Quoted the student's code; refused to give a new example |
| **F: V4.1 / gpt-oss** | **4.0 s** | **7.3 s** | **2%** | **0** | **6%** | Guardrail passed 1 of 4 injections (the reply still refused) |
| C: V4.1 low / none | 4.7 s | 16.2 s | 5% | 0 | 6% | |
| H: Haiku 4.5 | 5.4 s | 10.7 s | 11% | 0 | 6% | Most fallbacks were "wrong example type" rejections |
| B: V4.1 low / low | 6.2 s | 28.5 s | 14% | 0 | 3% | Strictest Dean: most fallbacks, slowest tail |
| G: Gemini 3.8 Flash | 7.7 s | 16.9 s | 3% | 2 | 6% | |

All four leaks were on one lesson, `mostCommonWord`: examples in a different setting (flower scents, fruit, votes) that are the same function and pass the lesson's tests when renamed. The Dean's rules allow "an example of the same concept with a different scenario", so they were approved. In phase 1, Haiku also produced one leak (a `sumOfDigits` solution under another name), which its Dean approved.

### Dean accuracy (phase 3, 60 planted drafts per setup)

| Dean | Overall | Clean approved | Leak caught | Corrected code caught | Wrong type caught | Broken code caught | Median time |
|---|---|---|---|---|---|---|---|
| A: V4 Flash 0731, default | 100% | 100% | 100% | 100% | 100% | 100% | 11.1 s |
| B: V4.1 low | 100% | 100% | 100% | 100% | 100% | 100% | 1.9 s |
| **F: gpt-oss-120b low** | **100%** | **100%** | **100%** | **100%** | **100%** | **100%** | **0.6 s** |
| G: Gemini 3.8 Flash low | 100% | 100% | 100% | 100% | 100% | 100% | 2.8 s |
| C: V4.1 none | 92% | 81% | 94% | 100% | 83% | 100% | 0.6 s |
| H: Haiku 4.5 none | 85% | 69% | 100% | 100% | 33% | 100% | 1.4 s |

The Dean needs some reasoning: without it (C, H), it both blocks good examples and misses problems. gpt-oss-120b on `low` matched the best Deans and was as fast as the reasoning-free ones.

## Decision

Setup **F** was adopted (PR #107):

- the fastest setup with **no leaks, no quoted student code and no refused new examples**;
- **perfect Dean accuracy**;
- the **lowest fallback rate** (2%).

Setup D was about 1 s faster but showed the behaviour we least want: refusing a new example and quoting the student's code. The team judged a small amount of leaking acceptable (it cannot be prevented completely), and refusing a new example worse.

The production settings now default to F (`server/config.py`, `OPENROUTER_*`). The Dean's fallback message was also changed to: "Our example-generating agent is misbehaving: its last attempt didn't pass our checks, so I didn't show it to you. Please try again."

## Limitations

- **Sample size:** 36 timed replies per setup for Get help, and 64 per setup across scenarios. Differences of about a second between the faster setups are within run-to-run variation; the gap to production is not.
- **One day, one location:** all runs were on 7 October 2026 from a staff laptop, not from the production server (Railway). Provider load and network distance vary, so production times should be confirmed from the server's `step <node>: <ms> ms` logs.
- **Automatic quality checks only:** the leak, syllabus and structure checks are objective but narrow. A blind human review of example quality (instructor) is still to be done.
- **Planted Dean drafts** are constructed cases, not real student conversations.
- **Reasoning effort:** DeepSeek on OpenRouter does not appear to honour graded effort levels closely (`low` still produced 300–1,000 reasoning tokens).

## Reproduce

```bash
cd server   # needs OPENROUTER_API_KEY in server/.env
uv run python -m eval.run speed --repeats 3
uv run python -m eval.run quality --configs A_v4-0731_default,B_v41_low-low,C_v41_low-none,D_v41_none-none,F_v41+gptoss-check,G_gemini-3.8-flash_low,H_haiku-4.5_none
uv run python -m eval.run dean --configs A_v4-0731_default,B_v41_low-low,C_v41_low-none,F_v41+gptoss-check,G_gemini-3.8-flash_low,H_haiku-4.5_none
uv run --with pandas python -m eval.report
```

The raw results in [`2026-10-07-data/`](2026-10-07-data/) have one JSON object per reply (`speed.jsonl`, `quality.jsonl`) or per Dean judgement (`dean.jsonl`). Each records the setup, lesson, scenario, round-trip and per-step times, every model call's tokens, the Dean's decision, the reply text and the check results. `uv run --with pandas python -m eval.report <file>` recomputes the tables.
