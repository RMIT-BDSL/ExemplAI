from pydantic import BaseModel

class StudentCode(BaseModel):
    code: str


# data model for sending to judge0
class CodeSubmission(StudentCode):
    language_id: int
    source_code: str
    