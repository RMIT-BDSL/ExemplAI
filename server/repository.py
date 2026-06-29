"""
Database access layer (Supabase).

Query functions only — no business logic (that's services.py) and no HTTP
(that's routers.py). The Supabase client is created lazily on first use from
SUPABASE_URL / SUPABASE_KEY.

NOTE: the BKT table/column names below are assumptions — adjust the constants to
match the actual schema once it's finalized.
"""

import os
import logging
from typing import Optional

from supabase import Client, create_client

log = logging.getLogger("rich")

# ── Schema assumptions (adjust to the real BKT table) ─────────────────
_BKT_TABLE = "bkt_mastery"
_COL_STUDENT = "student_id"
_COL_KC = "knowledge_component"
_COL_MASTERY = "prob_mastery"

_client: Optional[Client] = None


def _get_client() -> Client:
    """Lazily create and cache the Supabase client."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL / SUPABASE_KEY are not configured.")
        _client = create_client(url, key)
    return _client


def get_mastery(student_id: int, knowledge_component: str) -> float:
    """Return the student's BKT probMastery for a knowledge component.

    Defaults to 0.0 (novice) when no record exists — a new student with no
    history routes to Complete examples, which is the intended cold-start.
    """
    client = _get_client()
    response = (
        client.table(_BKT_TABLE)
        .select(_COL_MASTERY)
        .eq(_COL_STUDENT, student_id)
        .eq(_COL_KC, knowledge_component)
        .limit(1)
        .execute()
    )

    if not response.data:
        log.warning(
            f"No BKT mastery row for student={student_id} kc={knowledge_component}; defaulting to 0.0"
        )
        return 0.0

    return float(response.data[0][_COL_MASTERY])
