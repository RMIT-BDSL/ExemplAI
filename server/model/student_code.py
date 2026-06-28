from pydantic import BaseModel
from typing import List, Optional

class TestCase(BaseModel):
    input: str
    expectedOutput: str
    description: Optional[str] = None
    hidden: Optional[bool] = False

class StudentCode(BaseModel):
    code: str
    language_id: Optional[int] = 71
    starter_code: Optional[str] = None
    solution_code: Optional[str] = None
    test_cases: Optional[List[TestCase]] = None


# data model for sending to judge0
class CodeSubmission(BaseModel):
    language_id: int
    source_code: str
    stdin: Optional[str] = None