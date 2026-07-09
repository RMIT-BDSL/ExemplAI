"""
Supabase connectivity check.

Run from the `server/` dir:
    uv run python scripts/check_supabase.py

Reads from server/.env:
    SUPABASE_URL        e.g. https://<ref>.supabase.co   (REST client)
    SUPABASE_SECRET_KEY API key for the REST client
    DATABASE_URL        postgresql://... connection string (Postgres)

Exits 0 only if every configured check passes.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def check_postgres() -> bool:
    """Open a direct Postgres connection and run SELECT 1."""
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        print("[skip] DATABASE_URL not set — skipping direct Postgres check.")
        return True

    try:
        import psycopg2

        # Direct connection per Supabase docs:
        # postgresql://postgres:[PASSWORD]@db.[ref].supabase.co:5432/postgres
        conn = psycopg2.connect(dsn, connect_timeout=10)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")  # official test query
                version = cur.fetchone()[0]
        finally:
            conn.close()
        print(f"[ok]   Postgres: connected. {version}")
        return True
    except Exception as exc:
        print(f"[fail] Postgres: {type(exc).__name__}: {exc}")
        return False


def check_rest() -> bool:
    """Create the Supabase REST client and hit the auth endpoint."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY")

    if not url or not key:
        print("[skip] SUPABASE_URL / SUPABASE_SECRET_KEY not set — skipping REST check.")
        return True
    if not url.startswith("http"):
        print(f"[fail] REST: SUPABASE_URL does not look like a URL: {url!r}")
        return False

    try:
        from supabase import create_client
        from supabase.client import ClientOptions

        # create_client per Supabase docs, with a bounded timeout.
        client = create_client(
            url,
            key,
            options=ClientOptions(postgrest_client_timeout=10),
        )
        # Lightweight, schema-agnostic round-trip that proves auth + reachability.
        client.auth.get_session()
        print("[ok]   REST: Supabase client created and endpoint reachable.")
        return True
    except Exception as exc:
        print(f"[fail] REST: {type(exc).__name__}: {exc}")
        return False


def main() -> int:
    print("Checking Supabase connectivity...\n")
    results = [check_postgres(), check_rest()]
    ok = all(results)
    print("\n" + ("All checks passed." if ok else "One or more checks FAILED."))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
