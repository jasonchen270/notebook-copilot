import json
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sse_starlette.sse import EventSourceResponse

from app.api.deps import CurrentUser, DBSession
from app.db.session import SessionLocal
from app.models.chat import Message, Session
from app.schemas.chat import MessageIn, MessageOut, SessionCreate, SessionOut
from app.services.cells import extract_cells
from app.services.llm import ChatTurn, get_llm

router = APIRouter(prefix="/chat", tags=["chat"])


async def _load_session(db, user_id: UUID, session_id: UUID, with_messages: bool = False) -> Session:
    stmt = select(Session).where(Session.id == session_id, Session.user_id == user_id)
    if with_messages:
        stmt = stmt.options(selectinload(Session.messages))
    session = await db.scalar(stmt)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session not found")
    return session


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(user: CurrentUser, db: DBSession) -> list[SessionOut]:
    rows = await db.scalars(
        select(Session).where(Session.user_id == user.id).order_by(Session.updated_at.desc())
    )
    return [
        SessionOut(id=s.id, title=s.title, created_at=s.created_at, updated_at=s.updated_at)
        for s in rows
    ]


@router.post("/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(payload: SessionCreate, user: CurrentUser, db: DBSession) -> SessionOut:
    session = Session(user_id=user.id, title=payload.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionOut(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
async def list_messages(session_id: UUID, user: CurrentUser, db: DBSession) -> list[MessageOut]:
    session = await _load_session(db, user.id, session_id, with_messages=True)
    return [
        MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            cells=m.cells,
            created_at=m.created_at,
        )
        for m in session.messages
    ]


@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: UUID, payload: MessageIn, user: CurrentUser, db: DBSession
) -> EventSourceResponse:
    """Stream a model reply back as SSE.

    Event types:
        - "delta": incremental text from the model
        - "cells": the parsed notebook cells, sent once at end
        - "done":  signals the stream is complete
        - "error": fatal error mid-stream
    """
    session = await _load_session(db, user.id, session_id, with_messages=True)
    history = [ChatTurn(role=m.role, content=m.content) for m in session.messages]
    history.append(ChatTurn(role="user", content=payload.content))

    user_msg = Message(session_id=session.id, role="user", content=payload.content)
    db.add(user_msg)
    await db.commit()
    sid = session.id
    llm = get_llm()

    async def generator():
        buffer: list[str] = []
        try:
            async for delta in llm.stream_chat(history):
                buffer.append(delta)
                yield {"event": "delta", "data": json.dumps({"text": delta})}
            full = "".join(buffer)
            cells = extract_cells(full)

            # Open a fresh session here. The request-scoped one is already closed
            # by the time SSE streaming finishes.
            async with SessionLocal() as bg_db:
                assistant_msg = Message(
                    session_id=sid, role="assistant", content=full, cells=cells or None
                )
                bg_db.add(assistant_msg)
                await bg_db.commit()
                await bg_db.refresh(assistant_msg)
                message_id = str(assistant_msg.id)

            yield {"event": "cells", "data": json.dumps({"cells": cells})}
            yield {"event": "done", "data": json.dumps({"message_id": message_id})}
        except Exception as exc:  # noqa: BLE001
            yield {"event": "error", "data": json.dumps({"detail": str(exc)})}

    return EventSourceResponse(generator())
