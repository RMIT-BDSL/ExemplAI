# ExemplAI: BKT-Driven Adaptive Example-Based Learning AI Tutor

ExemplAI is an adaptive programming tutoring system designed to optimize cognitive load and enhance learning outcomes using Example-Based Learning (EBL). It dynamically selects and scaffolds code examples based on the student's current mastery level.

It is being built for a pilot RCT in the Python Programming Bootcamp (COSC3104/5) at RMIT Vietnam.

---
## ToDo List
Our major items still to accomplish are [listed here](TODO.md).

## 📖 Some Documentation
Explore the documentation below (Mermaid diagrams should load automatically):

* **[Running the project](setup.md)**: prerequisites (Node.js, pnpm, uv, optionally Moon) and how to run each part locally.

* **[Macro System Architecture](Macro_System_Architecture.md)**: 
  Explains the overall research objectives, participant experimental workflow (A/B testing), the 4-layer system design (UI, Data, LangGraph, and Safety), and a mockup of the Split-Pane interface.
  
* **[LangGraph & BKT Architecture Specification](LangGraph_BKT_Architecture_Spec.md)**: 
  Contains the detailed LangGraph agent state machine, deterministic BKT routing edge definitions, system prompts for all scaffolding modalities (Complete, Faded, and Erroneous examples), and the Pydantic-enforced Dean Validation Gate logic. The prompts in the spec are identical to the ones the server runs (checked by `server/test_spec_sync.py`).

---

## 🗂️ Repository Layout

| Folder | What it is |
|---|---|
| `web/` | Student app: TanStack Start (React) split-pane UI, plus the **Convex** backend (`web/convex/`: schema, lessons, chats, BKT mastery, example allowance, seed lessons) |
| `admin/` | Admin portal (SolidJS) for courses, lessons, test cases, invitation codes and release notes |
| `server/` | Python **FastAPI** server: code execution via Judge0, BKT updates (`bkt.py`), and the **LangGraph** tutor (`ai/`) using DeepSeek via OpenRouter |
| `data/` | BKT parameters (`bktParams.json`), the CSEDM 2019 fitting script and dataset notes |

Branches: work goes into **`dev`** through pull requests (auto-deploys the dev environment); merging into **`main`** cuts a release and deploys production.

---

## 🛠️ High-Level Architecture
Organise the system into some Layers:

1. **Layer 1: Frontend UI**: A split-pane interface separating the coding space (left pane: Run / Submit against the lesson's tests) from the AI Tutor chat (right pane).
2. **Layer 2: Data**: **Convex** stores lessons, progress, chats and each student's mastery per syllabus topic. A **Bayesian Knowledge Tracing** engine (`server/bkt.py`) updates `prob_mastery` on the first Submit of each lesson (hand-set parameters in `data/bktParams.json`, pending a refit on pilot data); `mastered` is set at 0.95. PostHog records analytics events.
3. **Layer 3: Orchestration**: A LangGraph state machine that routes students based on their BKT mastery:
   * **Novice (`probMastery < 0.3`)**: Receives **Complete Examples** of analog problems, with step labels, to reduce cognitive load.
   * **Intermediate (`0.3 <= probMastery <= 0.7`)**: Receives **Faded Examples** (the code under 1–2 steps left blank) to encourage active learning.
   * **Expert (`probMastery > 0.7`)**: Receives **Erroneous Examples** (one deliberate logic bug to fix) to foster deep error detection.
   * **Control**: A plain chat with the same LLM: students can ask anything, with no example types, buttons or limits.
4. **Layer 4: Safety & Guardrails**: An input guardrail screens student messages, and a **Dean Agent** audits every tutor reply before it reaches the student, preventing direct answers or code leaks (plus unsafe content and broken code; the experimental group also gets example-type checks).


