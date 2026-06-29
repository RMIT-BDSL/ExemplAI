from pydantic import BaseModel


# TODO: scope this model more properly
class Chat(BaseModel):
    # understand who is it
    user_id: int

    # normal chat - send full chat
    conversation: list[dict]

    # ── Tutor graph inputs (read into TutorGraphState) ────────────────
    # Sticky A/B assignment — must be read from persistent state, not
    # re-randomized per request (research integrity).
    experiment_condition: str = "experimental"

    # BKT routing input; orchestrator_router routes on this.
    bkt_prob_mastery: float = 0.0

    # Problem / submission context.
    original_problem: str = ""
    unit_test_assertions: str = ""
    current_knowledge_component: str = ""
    student_code: str = ""
    error_trace: str = ""
