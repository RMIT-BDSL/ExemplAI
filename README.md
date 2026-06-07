# ExemplAI: BKT-Driven Adaptive Example-Based Learning AI Tutor

ExemplAI is an adaptive programming tutoring system designed to optimize cognitive load and enhance learning outcomes using Example-Based Learning (EBL). It dynamically selects and scaffolds code examples based on the student's current mastery level.

---

## 📖 System Documentation

To understand the design, architecture, and agent specifications of the system, explore the documentation below:

* **[Macro System Architecture](Macro_System_Architecture.md)**: 
  Explains the overall research objectives, participant experimental workflow (A/B testing), the 4-layer system design (UI, Data, LangGraph, and Safety), and a mockup of the Split-Pane interface.
  
* **[LangGraph & BKT Architecture Specification](LangGraph_BKT_Architecture_Spec.md)**: 
  Contains the detailed LangGraph agent state machine, deterministic BKT routing edge definitions, system prompts for all scaffolding modalities (Complete, Faded, and Erroneous examples), and the Pydantic-enforced Dean Validation Gate logic.

---

## 🛠️ High-Level Architecture

The system operates across four coordinated layers to adapt to a student's "epistemological state":

1. **Layer 1: Frontend UI**: A Next.js-based Split-Pane interface separating the coding space (left pane) from the AI Tutor chat (right pane).
2. **Layer 2: Data**: Tracks student mastery probabilities (`probMastery`) using a Bayesian Knowledge Tracing (BKT) engine and logs events to Supabase.
3. **Layer 3: Orchestration**: A LangGraph state machine that routes students based on their BKT mastery:
   * **Novice (`probMastery < 0.3`)**: Receives **Complete Examples** of analog problems to reduce cognitive load.
   * **Intermediate (`0.3 <= probMastery <= 0.7`)**: Receives **Faded Examples** (partially completed code blocks) to encourage active learning.
   * **Expert (`probMastery > 0.7`)**: Receives **Erroneous Examples** (subtly buggy code challenges) to foster deep error detection.
4. **Layer 4: Safety & Guardrails**: A **Dean Agent** that audits and validates every LLM response before sending it to the student, preventing direct answers or code leaks.
