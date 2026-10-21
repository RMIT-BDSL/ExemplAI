from pydantic import BaseModel
from typing import List, Literal, Optional

class TestCase(BaseModel):
    input: str
    expectedOutput: str
    description: Optional[str] = None
    hidden: Optional[bool] = False

class StudentCode(BaseModel):
    code: str
    language_id: Optional[int] = 100
    starter_code: Optional[str] = None
    solution_code: Optional[str] = None
    test_cases: Optional[List[TestCase]] = None
    # Convex questions id — required for server-side has_run / BKT writes
    lesson_id: Optional[str] = None
    action_type: Optional[Literal["run", "submit"]] = "run"


class CheckSubmission(BaseModel):
    """One final answer to a quick-check problem (web/convex/quickChecks.ts)."""
    check_id: str
    code: str
    # Submitted by the page when the time ran out, not by the student.
    auto: bool = False


# data model for sending to judge0
class CodeSubmission(BaseModel):
    language_id: int
    source_code: str
    stdin: Optional[str] = None