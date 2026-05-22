from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.chat import Session
from app.models.run import CodeRun
from app.schemas.runs import RunIn, RunOut
from app.workers.queue import get_queue

router = APIRouter(prefix="/runs", tags=["runs"])


@router.post("", response_model=RunOut, status_code=status.HTTP_202_ACCEPTED)
async def enqueue(payload: RunIn, user: CurrentUser, db: DBSession) -> RunOut:
    session = await db.scalar(
        select(Session).where(Session.id == payload.session_id, Session.user_id == user.id)
    )
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session not found")

    run = CodeRun(
        user_id=user.id,
        session_id=payload.session_id,
        code=payload.code,
        status="queued",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    queue = get_queue()
    queue.enqueue("app.workers.run_executor.execute", str(run.id), payload.code, job_timeout=30)

    return RunOut(
        id=run.id,
        status=run.status,
        result=run.result,
        error=run.error,
        created_at=run.created_at,
        finished_at=run.finished_at,
    )


@router.get("/{run_id}", response_model=RunOut)
async def fetch(run_id: UUID, user: CurrentUser, db: DBSession) -> RunOut:
    run = await db.scalar(
        select(CodeRun).where(CodeRun.id == run_id, CodeRun.user_id == user.id)
    )
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "run not found")
    return RunOut(
        id=run.id,
        status=run.status,
        result=run.result,
        error=run.error,
        created_at=run.created_at,
        finished_at=run.finished_at,
    )
