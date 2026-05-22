from pathlib import Path
from uuid import UUID, uuid4

import aiofiles
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.core.config import get_settings
from app.models.file import UploadedFile
from app.schemas.files import FileOut

router = APIRouter(prefix="/files", tags=["files"])

_MAX_BYTES = 50 * 1024 * 1024  # 50 MB


def _upload_root() -> Path:
    root = Path(get_settings().upload_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


@router.post("", response_model=FileOut, status_code=status.HTTP_201_CREATED)
async def upload(
    user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(...),
) -> FileOut:
    storage_id = uuid4()
    user_dir = _upload_root() / str(user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    target = user_dir / f"{storage_id}_{file.filename}"

    written = 0
    async with aiofiles.open(target, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            written += len(chunk)
            if written > _MAX_BYTES:
                await out.close()
                target.unlink(missing_ok=True)
                raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file too large")
            await out.write(chunk)

    record = UploadedFile(
        id=storage_id,
        user_id=user.id,
        filename=file.filename or "upload.bin",
        storage_path=str(target),
        content_type=file.content_type or "application/octet-stream",
        size_bytes=written,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return FileOut(
        id=record.id,
        filename=record.filename,
        content_type=record.content_type,
        size_bytes=record.size_bytes,
        created_at=record.created_at,
    )


@router.get("", response_model=list[FileOut])
async def list_files(user: CurrentUser, db: DBSession) -> list[FileOut]:
    rows = await db.scalars(
        select(UploadedFile)
        .where(UploadedFile.user_id == user.id)
        .order_by(UploadedFile.created_at.desc())
    )
    return [
        FileOut(
            id=r.id,
            filename=r.filename,
            content_type=r.content_type,
            size_bytes=r.size_bytes,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/{file_id}/raw")
async def download(file_id: UUID, user: CurrentUser, db: DBSession):
    row = await db.scalar(
        select(UploadedFile).where(UploadedFile.id == file_id, UploadedFile.user_id == user.id)
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    path = Path(row.storage_path)
    if not path.exists():
        raise HTTPException(status.HTTP_410_GONE, "file no longer on disk")
    return FileResponse(path, filename=row.filename, media_type=row.content_type)
