from pydantic import BaseModel
from typing import Optional

class ScratchpadCode(BaseModel):
    code: str
    language_id: Optional[int] = 71
    stdin: Optional[str] = None
