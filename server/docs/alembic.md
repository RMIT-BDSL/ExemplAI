# Database Migrations (Alembic)

How schema changes are versioned and applied in ExemplAI's `server/`. Alembic is
our Liquibase/Flyway equivalent: ordered, reversible migration scripts with a
single source of truth in `migrations/versions/`.

> All commands run from the `server/` directory via `uv`.

---

## How it's wired

- **`alembic.ini`** — `sqlalchemy.url` is intentionally blank; the real URL is
  injected at runtime.
- **`migrations/env.py`** — pulls the connection string from
  `settings.DATABASE_URL` (see `config.py`) and coerces it to
  `postgresql+psycopg2://`. Key options set here:
  - `target_metadata = Base.metadata` (from `db/base.py`) — what autogenerate
    diffs against.
  - `transaction_per_migration=True` — each migration runs in its own
    transaction, so a failure rolls back atomically (see [Rollback](#rollback)).
  - `include_object` — **ignores any table not defined in our models**, so the
    LangGraph checkpoint tables (`checkpoints`, `checkpoint_blobs`,
    `checkpoint_writes`, `checkpoint_migrations`) and Supabase-managed tables are
    never touched by migrations.
- **`db/base.py`** — the SQLAlchemy `Base` (declarative metadata registry).
- **`db/models.py`** — where table models live (create it when you add the first
  table). Autogenerate only sees models imported into `env.py`.

### Connection requirement

`DATABASE_URL` **must** be a Supabase **Session Pooler** URL (port `5432`) or a
direct connection — never the **Transaction Pooler** (port `6543`), which breaks
Alembic's DDL/prepared statements. On this project the direct host is IPv6-only,
so use the session pooler:

```
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

---

## Everyday commands

```bash
# See current DB revision and full history
uv run alembic current
uv run alembic history

# Apply all pending migrations (the command you'll run most)
uv run alembic upgrade head

# Roll back one migration / to a specific revision / everything
uv run alembic downgrade -1
uv run alembic downgrade <revision>
uv run alembic downgrade base

# Fail (exit 1) if models have changes not captured in a migration — good CI gate
uv run alembic check
```

---

## Adding a table or changing the schema (autogenerate workflow)

We use **model-driven autogenerate**. The flow:

1. **Define/modify the model** in `db/models.py`, subclassing `Base`:

   ```python
   from sqlalchemy import Integer, String, Float, UniqueConstraint
   from sqlalchemy.orm import Mapped, mapped_column
   from db.base import Base

   class BktMastery(Base):
       __tablename__ = "bkt_mastery"
       id: Mapped[int] = mapped_column(Integer, primary_key=True)
       student_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
       knowledge_component: Mapped[str] = mapped_column(String, nullable=False)
       prob_mastery: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
       __table_args__ = (
           UniqueConstraint("student_id", "knowledge_component", name="uq_bkt_student_kc"),
       )
   ```

2. **Register the models** with autogenerate — the first time you add
   `db/models.py`, uncomment this line in `migrations/env.py`:

   ```python
   import db.models  # noqa: F401 — registers models on Base.metadata
   ```

3. **Generate the migration** (requires a live DB connection):

   ```bash
   uv run alembic revision --autogenerate -m "create bkt_mastery"
   ```

4. **Review the generated file** in `migrations/versions/`. Autogenerate is not
   perfect — it can miss column/table renames, CHECK constraints, and server
   defaults. Confirm `upgrade()` and `downgrade()` are correct before applying.

5. **Apply it:**

   ```bash
   uv run alembic upgrade head
   ```

6. **Commit** the new file in `migrations/versions/` to git. Every teammate / CI
   / prod runs `alembic upgrade head` to catch up.

### Hand-written migrations

For changes autogenerate can't express (data backfills, raw SQL), create an
empty revision and write `upgrade()`/`downgrade()` yourself:

```bash
uv run alembic revision -m "backfill mastery defaults"
```

---

## Rollback

- **Error mid-migration:** because Postgres has transactional DDL and we set
  `transaction_per_migration=True`, a failing `upgrade()` rolls back that
  migration atomically — the DB stays at the previous revision, no partial state.
- **Undo an applied migration:** `alembic downgrade` runs the reverse
  `downgrade()` — this is deliberate, not crash recovery.
- **Exception:** statements that cannot run inside a transaction break the atomic
  guarantee — notably `CREATE INDEX CONCURRENTLY` and some enum
  `ALTER TYPE ... ADD VALUE`. Put those in their own isolated revision.

---

## How versions match across environments

- Alembic stores the current revision in the `alembic_version` table (one row).
- `upgrade head` walks from the DB's recorded revision to the newest script,
  applying only the gap in `down_revision` order.
- Committed revision files are the shared source of truth: same files + same
  target = same schema everywhere.
- **Branch conflict** (two people branch off the same revision → multiple heads):
  resolve with `uv run alembic merge -m "merge heads" <rev1> <rev2>`.

---

## What Alembic does NOT manage

- **LangGraph checkpoint tables** — created by the app at startup via
  `AsyncPostgresSaver.setup()` (see `ai/checkpointer.py`). They are excluded by
  `include_object` in `env.py`; never add them to a migration.
- **Supabase-managed schemas** (`auth.*`, `storage.*`) — left untouched.

---

## Gotchas

- Running `--autogenerate` needs a working DB connection; a bad/empty
  `DATABASE_URL` fails fast with a connection error.
- If `alembic check` reports drift you didn't intend, you likely changed a model
  without generating a migration — run the autogenerate flow above.
- Never edit an already-applied, already-committed migration. Add a new one.
