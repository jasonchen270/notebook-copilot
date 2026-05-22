from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

_settings = get_settings()
_is_sqlite = _settings.database_url.startswith("sqlite")

# pool_pre_ping issues a sync SELECT 1 that doesn't go through the async greenlet
# adapter on aiosqlite, so turn it off for SQLite. Postgres handles it fine.
engine = create_async_engine(
    _settings.database_url,
    pool_pre_ping=not _is_sqlite,
    future=True,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
