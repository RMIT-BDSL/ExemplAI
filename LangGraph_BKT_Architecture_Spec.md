# LangGraph Architecture Specification: BKT-Driven Example-Based Learning

## 1. Architectural Overview
This document outlines the target LangGraph architecture for the adaptive Example-Based Learning (EBL) AI Tutor. It explicitly bridges the gap between the theoretical **Expertise Reversal Effect (ERE)** and technical implementation. 

Unlike standard LLM chatbots that use a single agent to handle all queries, this architecture uses a **Deterministic Router (Conditional Edge)**. The router retrieves the student's mathematical mastery probability (`probMastery`) from the Bayesian Knowledge Tracing (BKT) engine and strictly routes the request to one of three highly specialized Example-Based Learning (EBL) Agent Nodes.

---

## 2. LangGraph State Machine Diagram

```mermaid
graph TD
    %% Nodes
    A1([Code Window: Student Submits Code])
    A2([AI Window: Student Replies in Chat])
    B1[Automated Unit Tests<br/>Pass/Fail]
    B2[(Update BKT Mastery)]
    B3[(Fetch New BKT probMastery)]
    LLMEval[LLM Conversational Eval<br/>No BKT Update]
    ExpRouter{A/B Experiment<br/>Condition Router}
    C{Orchestrator<br/>Conditional Edge}
    Control[Control Condition<br/>Standard Agent LLM or Random]
    
    D[Complete Example Agent]
    E[Faded Example Agent]
    F[Erroneous Example Agent]
    
    Dean[Dean Agent<br/>Safety Validation]
    G([Send Approved Response to Chat UI])
    H[(Log Intervention to BKT)]

    %% Flow
    A1 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> ExpRouter
    
    A2 --> LLMEval
    LLMEval --> ExpRouter
    
    ExpRouter -- "Control Group" --> Control
    ExpRouter -- "Experimental Group" --> C
    
    %% Routing Logic
    C -- "probMastery &lt; 0.3<br/>(Novice)" --> D
    C -- "0.3 &le; probMastery &le; 0.7<br/>(Intermediate)" --> E
    C -- "probMastery &gt; 0.7<br/>(Expert)" --> F
    
    D --> Dean
    E --> Dean
    F --> Dean
    Control --> Dean
    Dean --> G
    G -. Async Hook .-> H

    %% Styling
    classDef startNode fill:#2d3436,stroke:#dfe6e9,stroke-width:2px,color:#fff
    classDef dbNode fill:#0984e3,stroke:#74b9ff,stroke-width:2px,color:#fff
    classDef edgeNode fill:#d63031,stroke:#fab1a0,stroke-width:2px,color:#fff
    classDef agentNode fill:#00b894,stroke:#55efc4,stroke-width:2px,color:#fff
    classDef agent2Node fill:#00856b,stroke:#004d40,stroke-width:2px,color:#fff
    classDef evalNode fill:#e17055,stroke:#fab1a0,stroke-width:2px,color:#fff
    classDef safetyNode fill:#d63031,stroke:#fab1a0,stroke-width:2px,color:#fff
    
    class A1,A2,G startNode
    class B2,B3,H dbNode
    class C edgeNode
    class D,E,F agentNode
    class Control agent2Node
    class B1,LLMEval evalNode
    class Dean safetyNode
```

---

## 3. LangGraph State Specification

The `GraphState` (TypedDict) must carry the BKT context alongside the standard conversation history so that the downstream agents know *why* they were invoked.

```python
from typing import TypedDict, List, Annotated
from langgraph.graph.message import add_messages

class TutorGraphState(TypedDict):
    messages: Annotated[List[dict], add_messages]
    original_problem: str                 # The static target problem description from the dataset
    reference_solution: str               # The canonical correct solution from the Convex DB
    unit_test_assertions: str             # The deterministic unit test code (assert statements)
    current_knowledge_component: str      # e.g., "KC_Loop_Syntax"
    bkt_prob_mastery: float               # Float 0.0 - 1.0 fetched from BKT DB
    pedagogical_modality: str             # e.g., "Complete", "Faded", "Erroneous"
    student_code: str                     # The raw buggy code submitted
    error_trace: str                      # Unit test failure output (deterministic)
    experiment_condition: str             # "experimental" or "control"
    draft_response: str                   # Agent's unvetted draft; only the Dean writes to `messages`
    response_type: str                    # "new_example" | "follow_up" (set by the agent node)
```

`response_type` tells the Dean what kind of reply it is checking. A **new example** must match its modality (Complete / Faded / Erroneous). A **follow-up** (answering a question, feedback on the student's attempt, a narrower hint) is checked against the modality's follow-up rules instead, so it is not rejected for lacking blanks or a bug.

---

## 4. Node & Edge Specifications

### 4.1 The Orchestrator Router (Conditional Edge)
**Type:** Pure Python Function (Not an LLM)
**Purpose:** To strictly enforce the pedagogical boundaries defined by Cognitive Load Theory and prevent LLM routing hallucinations.

**Implementation Logic:**
```python
def orchestrator_router(state: TutorGraphState) -> str:
    mastery = state.get("bkt_prob_mastery", 0.15) # Default to P-Init baseline
    
    if mastery < 0.3:
        return "complete_example_node"
    elif 0.3 <= mastery <= 0.7:
        return "faded_example_node"
    else:
        return "erroneous_example_node"
```

### 4.2 System Prompt Agents

These will be tested and iterated upon. The agents are responsible for generating the 3 example types, the standard control responses, and the Dean validation gate. All prompts follow LangGraph best practices:

- **Message Separation:** Static instructions live in `SystemMessage`. Dynamic, per-invocation context is injected via `HumanMessage` using XML-delimited blocks for reliable extraction.
- **Structured Output:** The Dean Agent uses a Pydantic schema to enforce a deterministic pass/reject response.
- **Node Functions:** Each agent is a standard LangGraph node function that reads from and writes to `TutorGraphState`.
- **Drafts, not messages:** Agents write `draft_response`, `pedagogical_modality` and `response_type`. They never append to `messages`; the Dean is the only node that does, so no unvetted text reaches the student.
- **Response type:** Each EBL agent starts its reply with a `[NEW_EXAMPLE]` or `[FOLLOW_UP]` tag, which the node strips (see 4.2.0). The first tutor reply in a conversation is always `new_example`, whatever the tag says.

#### 4.2.0 Shared: response type
Implemented in `server/ai/nodes/context.py`.

```python
RESPONSE_TYPE_INSTRUCTION = """

<response_type>
Start your reply with exactly one tag on its own first line:
[NEW_EXAMPLE] if this reply presents a new example: your first reply in the \
conversation, or the student asked for a different example.
[FOLLOW_UP] if this reply responds to the student about an example you already \
gave: answering a question, giving feedback on their attempt, or a narrower hint.
The tag is removed before the student sees your reply.
If <examples_remaining> is 0, do not present a new example, even if the student \
asks for one: help them with the examples already given instead.
</response_type>"""


def split_response_type(raw: str, state: TutorGraphState) -> tuple[str, str]:
    """Strip the tag; return (draft, response_type).

    - No earlier tutor reply in the conversation -> always "new_example".
    - Otherwise use the tag; if it is missing, default to "follow_up".
    """
```

The Control agent is not asked for a tag: its `response_type` comes from the history alone (first reply = `new_example`, later = `follow_up`). The Dean applies no modality checks to the control condition, so the label is only for logging.

---

#### 4.2.1 Complete Example Agent (`complete_example_node`)
**Target Audience:** Novices (`probMastery < 0.3`). High risk of extraneous cognitive load.

**Node Function:**
```python
from langchain_core.messages import SystemMessage, HumanMessage

COMPLETE_EXAMPLE_SYSTEM = """You are a patient, supportive programming tutor helping a novice \
student who is struggling with a coding problem.

<role>
You teach by providing COMPLETE, fully worked examples of ANALOGOUS problems. You never \
ask the student to guess or fill in blanks — novices need a full model to study first.
</role>

<rules>
- Generate a DIFFERENT but conceptually analogous problem that exercises the same underlying \
concept the student is failing on (e.g., loop iteration, conditional logic, accumulation).
- Use a DIFFERENT domain or scenario so the student CANNOT copy-paste your code as a solution.
- NEVER directly reference, debug, or fix the student's actual code.
- NEVER provide code that solves the student's Target Problem.
- Add inline comments on every meaningful line explaining WHY that line exists.
- End with a bridge statement guiding the student back to their own code.
</rules>

<multi_turn>
If the student replies with a follow-up question, answer it supportively while staying \
within the analog problem domain. If they ask you to solve their actual problem, gently \
redirect: "Let's keep working through this example first — the pattern will click."
If the student asks for a DIFFERENT example, acknowledge the request and generate a NEW \
complete example using a completely DIFFERENT scenario to prevent pattern-matching.
</multi_turn>

<output_format>
1. Analog problem statement (1-2 sentences)
2. Complete, fully functioning code solution with inline comments
3. Bridge statement: "Now look at your code on the left. Can you see how the same pattern applies?"
</output_format>"""


def complete_example_node(state: TutorGraphState):
    human_msg = f"""The student needs help. Here is their current situation:

<target_problem>
{state["original_problem"]}
</target_problem>

<student_code>
{state["student_code"]}
</student_code>

<test_result>
{state["error_trace"]}
</test_result>

<knowledge_component>
{state["current_knowledge_component"]}
</knowledge_component>

Generate a complete worked example for an analogous problem that targets the concept above."""

    response = llm.invoke([
        SystemMessage(content=COMPLETE_EXAMPLE_SYSTEM + RESPONSE_TYPE_INSTRUCTION),
        *state["messages"],  # conversation history
        HumanMessage(content=human_msg),
    ])
    draft, response_type = split_response_type(str(response.content), state)
    return {"draft_response": draft, "pedagogical_modality": "Complete", "response_type": response_type}
```

---

#### 4.2.2 Faded Example Agent (`faded_example_node`)
**Target Audience:** Intermediates (`0.3 ≤ probMastery ≤ 0.7`). Transitioning to independent problem solving.

**Node Function:**
```python
FADED_EXAMPLE_SYSTEM = """You are a scaffolding tutor helping an intermediate programming \
student who understands basic syntax but needs help assembling structural logic.

<role>
You teach by providing FADED (partially completed) code examples of ANALOGOUS problems. \
You deliberately omit critical lines so the student must fill in the gaps themselves.
</role>

<rules>
- Generate a DIFFERENT but conceptually analogous problem that targets the same concept \
the student is struggling with. Use a DIFFERENT scenario.
- NEVER directly reference, debug, or fix the student's actual code.
- NEVER provide code that solves the student's Target Problem.
- Deliberately omit 2-3 critical lines, replacing them with clearly marked blanks:
  # ???: What goes here to [description of what the line should do]?
- The blanks MUST target the exact conceptual gap revealed by the student's test failure.
- After the code block, ask exactly ONE targeted question guiding the student toward the \
most important blank.
</rules>

<multi_turn>
When the student replies with their attempt to fill in the blanks:
- If CORRECT: Affirm them, reveal the completed code, and bridge back: \
"Exactly right! Now go back to your code on the left and apply the same logic."
- If PARTIALLY CORRECT: Acknowledge what's right, give a narrower hint for \
the remaining blank. Do NOT fill it in.
- If WRONG: Do NOT reveal the answer. Rephrase the question using a concrete \
analogy, or trace through the code with a sample input to help them see the gap.
- If they ask for a DIFFERENT example: Acknowledge the request and generate a NEW \
faded example using a completely DIFFERENT scenario to prevent pattern-matching.
</multi_turn>

<output_format>
1. Analog problem statement (1-2 sentences)
2. Structural code template with blanks clearly marked
3. ONE targeted question about the most important blank
</output_format>"""


def faded_example_node(state: TutorGraphState):
    human_msg = f"""The student needs scaffolded help. Here is their current situation:

<target_problem>
{state["original_problem"]}
</target_problem>

<student_code>
{state["student_code"]}
</student_code>

<test_result>
{state["error_trace"]}
</test_result>

<knowledge_component>
{state["current_knowledge_component"]}
</knowledge_component>

Generate a faded example for an analogous problem. Omit 2-3 lines targeting the concept above."""

    response = llm.invoke([
        SystemMessage(content=FADED_EXAMPLE_SYSTEM + RESPONSE_TYPE_INSTRUCTION),
        *state["messages"],
        HumanMessage(content=human_msg),
    ])
    draft, response_type = split_response_type(str(response.content), state)
    return {"draft_response": draft, "pedagogical_modality": "Faded", "response_type": response_type}
```

---

#### 4.2.3 Erroneous Example Agent (`erroneous_example_node`)
**Target Audience:** Experts (`probMastery > 0.7`). High risk of the Expertise Reversal Effect.

**Node Function:**
```python
ERRONEOUS_EXAMPLE_SYSTEM = """You are a senior developer presenting a "code review" \
challenge to a competent programming student.

<role>
You teach by presenting PLAUSIBLE BUT SUBTLY BUGGY code for an ANALOGOUS problem and \
challenging the student to find the bug. This forces deep analytical thinking without \
spoon-feeding the answer.
</role>

<rules>
- Generate a DIFFERENT but conceptually analogous problem. NEVER generate buggy code \
for the student's actual Target Problem — always use a different scenario.
- NEVER directly reference, debug, or fix the student's actual code.
- The bug MUST be non-trivial: off-by-one errors, incorrect boundary conditions, wrong \
operator precedence, missing edge cases, or flawed accumulator logic. NOT syntax errors.
- Present the code as if YOU wrote it and ask the student to find the flaw.
- Provide a specific failing test case as a concrete starting point.
- Do NOT provide structural templates, hints, or direct answers to the Target Problem.
</rules>

<multi_turn>
When the student replies with their diagnosis:
- If CORRECT: Confirm enthusiastically, explain WHY the bug causes the failure, and \
bridge back: "Sharp eye! Does looking at this bug remind you of anything in your own \
code on the left?"
- If PARTIALLY CORRECT: Acknowledge the insight, then push deeper: "You're on the \
right track — trace through [edge_case_input] step by step. What does the variable \
equal after iteration 3?"
- If WRONG: Do NOT reveal the answer. Ask them to manually trace the code execution \
with the failing test case, line by line.
- If they ask for a DIFFERENT example: Acknowledge the request and generate a NEW \
erroneous example using a completely DIFFERENT scenario to prevent pattern-matching.
</multi_turn>

<output_format>
1. Analog problem statement (1-2 sentences)
2. Plausible but buggy code snippet
3. A specific failing test case: "I wrote this solution, but it fails when I test it \
with [input]. Can you figure out what's wrong?"
</output_format>"""


def erroneous_example_node(state: TutorGraphState):
    human_msg = f"""The student is advanced and needs a debugging challenge. \
Here is their current situation:

<target_problem>
{state["original_problem"]}
</target_problem>

<student_code>
{state["student_code"]}
</student_code>

<test_result>
{state["error_trace"]}
</test_result>

<knowledge_component>
{state["current_knowledge_component"]}
</knowledge_component>

Generate a subtly buggy code example for an analogous problem targeting the concept above."""

    response = llm.invoke([
        SystemMessage(content=ERRONEOUS_EXAMPLE_SYSTEM + RESPONSE_TYPE_INSTRUCTION),
        *state["messages"],
        HumanMessage(content=human_msg),
    ])
    draft, response_type = split_response_type(str(response.content), state)
    return {"draft_response": draft, "pedagogical_modality": "Erroneous", "response_type": response_type}
```

---

#### 4.2.4 Control Agent (`control_agent_node`)
**Target Audience:** Control group (Option 1 in ResearchMethodology.md §4.2: a standard, non-adaptive AI tutor). It gets the same guardrail as the experimental group (§4.4: never provide a complete solution) and goes through the same Dean, but without modality checks.

*If the team chooses Option 2 (random router) instead, control students are routed randomly to the three EBL agents and this agent is unused; the Dean would then apply the experimental checks.*

**Node Function:**
```python
CONTROL_SYSTEM = """You are a helpful programming tutor. Help the student with \
their problem the way a standard AI assistant would: explain concepts, point out \
issues in their code, and guide them toward a working solution. Be clear and \
concise.

Do not write out a complete solution to the student's problem, or a fully \
corrected version of their code. Explaining an error, pointing to where it is, \
giving a hint, or showing a short snippet of syntax is fine."""


def control_agent_node(state: TutorGraphState):
    response = llm.invoke([
        SystemMessage(content=CONTROL_SYSTEM),
        HumanMessage(content=student_context(state)),
    ])
    return {
        "draft_response": str(response.content),
        "pedagogical_modality": "Control",
        "response_type": response_type_from_history(state),  # no tag; first reply vs later
    }
```

---

#### 4.2.5 Dean Agent (`dean_validation_node`)
**Purpose:** Institutional safety gate. Every response drafted by an EBL Agent or the Control Agent must pass through the Dean Agent before it reaches the student UI. The Dean is the only node that appends to `messages`.

Its checks depend on the condition and the draft's `response_type`:

| | `new_example` | `follow_up` |
|---|---|---|
| **Experimental** | Always-checks + MODALITY_VIOLATION (+ EXAMPLE_LIMIT at 0 remaining) | Always-checks + MODALITY_DRIFT (+ EXAMPLE_LIMIT at 0 remaining) |
| **Control** | Always-checks only | Always-checks only |

**Example allowance** (`web/convex/examples.ts`): each failed Submit earns one example, up to 3 per lesson round; Get help gives the first, the New example button the rest. Opening another lesson and returning starts a new round once the 3 are used. The server passes `examples_remaining` to the agents and the Dean. A typed request whose draft is labelled `new_example` with none remaining is answered with a limit message without calling the Dean's LLM; a mislabelled one is caught by EXAMPLE_LIMIT. The Dean sets `delivered_response_type` (the draft's type, or `fallback` if replaced), which is saved with the message; only delivered new examples count.

*Always-checks:* DIRECT_ANSWER_LEAK (judged against the recent conversation, so an answer pieced together over several turns is caught), INAPPROPRIATE_CONTENT, HALLUCINATED_CODE. For control, a "leak" is a complete working solution or a fully corrected version of the student's code; explanations, hints and short syntax snippets are allowed.

**Structured Output Schema:**
```python
class DeanValidationResult(BaseModel):
    status: Literal["approved", "rejected"]
    reason: Optional[str] = None
    violation_excerpt: Optional[str] = None
```

**Node Function:**
```python
DEAN_SYSTEM = """You are the Dean, an academic integrity validator for a \
university programming tutor. Decide whether the drafted reply may reach the \
student. You do not write tutoring content.

<inputs>
- experiment_condition: "experimental" (example-based tutor) or "control" \
(standard tutor).
- pedagogical_modality: Complete | Faded | Erroneous | Control.
- response_type: "new_example" (a fresh example) or "follow_up" (a reply about \
an example or answer already given).
- examples_remaining: new examples the student may still receive in this \
lesson ("not limited" if unknown).
- conversation_history: recent turns in this lesson, oldest first.
- original_problem, student_code, draft_response.
</inputs>

<always_check>
Apply to every draft, in both conditions:
1. DIRECT_ANSWER_LEAK: the draft hands the student a solution to \
<original_problem>. Judge it against the whole conversation: reject a draft that \
supplies the last missing piece of a solution assembled over earlier turns.
   - experimental: reject code that solves <original_problem>, or an example \
that could be trivially adapted (renaming, minor restructuring) into a solution.
   - control: reject a complete working solution to <original_problem> or a \
fully corrected version of <student_code>. Explaining an error, pointing to \
where it is, a hint, or a short syntax snippet is allowed.
2. INAPPROPRIATE_CONTENT: unsafe, offensive, or off-topic content.
3. HALLUCINATED_CODE: code that is broken or fabricated unintentionally. \
Exceptions: the intentional bug in an Erroneous example (including when the \
reply discusses it), and the student's own code quoted back to them.
</always_check>

<experimental_new_example>
Only when experiment_condition is "experimental" and response_type is \
"new_example":
4. MODALITY_VIOLATION: the example does not match <pedagogical_modality>: \
Complete = a full worked parallel example; Faded = a parallel example with \
deliberate blanks for the student to fill; Erroneous = a parallel example with \
one intentional, non-trivial logic bug for the student to find.
</experimental_new_example>

<experimental_follow_up>
Only when experiment_condition is "experimental" and response_type is \
"follow_up". Do NOT require blanks or a bug here. Check instead:
5. MODALITY_DRIFT: the reply breaks the follow-up rules of its modality:
   - Faded: fills in a blank, or reveals the completed code, before the \
student has correctly completed it themselves.
   - Erroneous: reveals where the bug is or how to fix it before the student \
has correctly diagnosed it.
   - Complete: leaves the parallel example and starts working on \
<original_problem> itself.
Answering the student's question, re-explaining, giving feedback on their \
attempt, or giving a narrower hint is allowed.
</experimental_follow_up>

<example_limit>
Only when experiment_condition is "experimental" and examples_remaining is 0:
6. EXAMPLE_LIMIT: the draft presents a new worked example (a new parallel \
problem with its own code), whatever its response_type says. Discussing, \
re-explaining or hinting about examples already given is allowed.
</example_limit>

<control>
In the control condition, apply only checks 1-3. There are no modality checks.
</control>

Otherwise approve (status="approved"). On rejection, set reason to the check \
name and violation_excerpt to the offending snippet."""


def dean_input(state: TutorGraphState) -> str:
    return (
        f"<experiment_condition>{state['experiment_condition']}</experiment_condition>\n"
        f"<pedagogical_modality>{state['pedagogical_modality']}</pedagogical_modality>\n"
        f"<response_type>{state['response_type']}</response_type>\n"
        f"<examples_remaining>{state['examples_remaining']}</examples_remaining>\n"
        f"<conversation_history>\n{recent_history(state)}\n</conversation_history>\n"  # last 10 turns
        f"<original_problem>\n{state['original_problem']}\n</original_problem>\n"
        f"<student_code>\n{state['student_code']}\n</student_code>\n"
        f"<draft_response>\n{state['draft_response']}\n</draft_response>"
    )


def dean_validation_node(state: TutorGraphState):
    result = llm.with_structured_output(DeanValidationResult).invoke([
        SystemMessage(content=DEAN_SYSTEM),
        HumanMessage(content=dean_input(state)),
    ])
    if result.status == "approved":
        return {"messages": [{"role": "ai", "content": state["draft_response"]}],
                "delivered_response_type": state["response_type"]}
    # Rejected: the draft never reaches the student; send a safe fallback instead
    # (the limit message for EXAMPLE_LIMIT).
    return {"messages": [{"role": "ai", "content": FALLBACK}], "delivered_response_type": "fallback"}
```

---

## 5. Required Backend Integrations
To make this graph function align with the Split-Pane UX and RCT methodology, developers must build the following API routing logic prior to graph invocation:

1. **Input Split (Code vs Chat):** The API must differentiate between interactions in the Left Pane vs Right Pane.
   * **Left Pane (Code Submission):** Triggers deterministic **Automated Unit Tests**. The Pass/Fail result is sent to the BKT database to mathematically update their `probMastery`.
   * **Right Pane (Chat Reply):** Bypasses unit testing and BKT updates. Routes directly to the active LLM agent for **Conversational Evaluation** (checking if they understood the pedagogical hint).
2. **A/B Experiment Routing:** After handling the input, the router checks the student's RCT cohort. Control Group students bypass the BKT engine entirely and are routed to a generic `Control Agent` (Standard LLM). Experimental Group students proceed to the Orchestrator.
3. **State Injection (Experimental Group):** Fetch the newly updated `probMastery` float and inject it into the `TutorGraphState` before invoking the Orchestrator conditional edge.
4. **Post-Graph Logging (Phase 2):** After the selected agent (Control or EBL) drafts a response, it passes through the Dean Agent for safety validation. Once passed to the UI, trigger an async job to log the intervention type (Control, Complete, Faded, Erroneous), the `response_type` (new example or follow-up), and the Dean's decision and reason to Supabase.
5. **UI Streaming Constraints (Dean Validation):** Because the Dean Agent must approve the full draft *before* the student sees it, the backend CANNOT stream raw tokens from the EBL agents directly to the UI. The frontend must display a loading state (e.g., "Tutor is thinking...") while the graph executes. Once the Dean approves, the backend returns the full string. The frontend may then use a Javascript typewriter effect to simulate streaming for a better UX.
