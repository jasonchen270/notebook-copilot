from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class RunIn(BaseModel):
    session_id: UUID
    code: str = Field(min_length=1, max_length=200_000)


class RunOut(BaseModel):
    id: UUID
    status: str
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    finished_at: datetime | None = None
