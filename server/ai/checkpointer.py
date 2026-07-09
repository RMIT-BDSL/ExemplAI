"""
LangGraph Postgres checkpointer wiring.

Opens a pooled AsyncPostgresSaver against DATABASE_URL for multi-turn session
memory (see CLAUDE.md). The app lifespan calls open_checkpointer() at startup,
compiles the tutor graph with the returned saver, and closes the pool on
shutdown.

Requires DATABASE_URL to be a Session Pooler (port 5432) or direct connection —
the saver uses prepared statements, which the transaction pooler (6543) does not
support. The connection string is passed to psycopg (v3) verbatim, so
``?sslmode=require`` and other query params are honored.
"""

from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from config import settings


async def open_checkpointer() -> tuple[AsyncConnectionPool, AsyncPostgresSaver]:
    """Open the connection pool and return (pool, saver).

    Checkpoint tables are created via a separate autocommit connection because
    the DDL cannot run inside the pool's transactional connections. .setup() is
    idempotent, so running it every boot is safe.
    """
    dsn = settings.DATABASE_URL.get_secret_value()

    pool = AsyncConnectionPool(conninfo=dsn, min_size=1, max_size=5, open=False)
    await pool.open()

    async with await AsyncConnection.connect(dsn, autocommit=True) as setup_conn:
        await AsyncPostgresSaver(setup_conn).setup()

    return pool, AsyncPostgresSaver(pool)
