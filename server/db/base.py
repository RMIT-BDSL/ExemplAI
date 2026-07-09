"""
SQLAlchemy declarative base — the single MetaData registry Alembic diffs
against for autogenerate.

No models are defined yet. When you add one, define it in db/models.py
subclassing this Base, then import that module in migrations/env.py so the
tables register on Base.metadata before autogenerate runs.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
