from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    title: str = "Untitled notebook"


class SessionOut(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=20_000)


class MessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    cells: list[dict[str, Any]] | None = None
    created_at: datetime
