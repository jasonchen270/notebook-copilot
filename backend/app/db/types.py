"""Cross-dialect column types so the same models work on Postgres and SQLite."""

import uuid as _uuid

from sqlalchemy import JSON, CHAR, String, TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class UUIDType(TypeDecorator):
    """UUID column that uses native UUID on Postgres and CHAR(36) on SQLite.

    Handles value conversion in both directions so callers always see `uuid.UUID`.
    """

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value if isinstance(value, _uuid.UUID) else _uuid.UUID(str(value))
        return str(value) if isinstance(value, _uuid.UUID) else str(_uuid.UUID(str(value)))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value if isinstance(value, _uuid.UUID) else _uuid.UUID(str(value))


JSONType = JSONB().with_variant(JSON(), "sqlite")
