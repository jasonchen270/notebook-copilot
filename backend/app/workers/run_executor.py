"""rq job entrypoint.

Executes a code snippet in a subprocess with a hard time/output cap. This path
is only used when the client explicitly opts into server-side execution (e.g.
'run on the cluster' for a large dataset). The default path runs in Pyodide.
"""

from __future__ import annotations

import resource
import subprocess
import sys
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import create_engine, update
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.models.run import CodeRun

_SYNC_URL = get_settings().database_url.replace("+asyncpg", "+psycopg")


def _sync_session():
    engine = create_engine(_SYNC_URL, future=True)
    return sessionmaker(engine, expire_on_commit=False)()


def _limit_resources() -> None:
    resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))


def execute(run_id: str, code: str) -> dict:
    started = datetime.now(timezone.utc)
    try:
        proc = subprocess.run(
            [sys.executable, "-I", "-c", code],
            capture_output=True,
            text=True,
            timeout=15,
            preexec_fn=_limit_resources,
            check=False,
        )
        result = {
            "stdout": proc.stdout[-4000:],
            "stderr": proc.stderr[-4000:],
            "returncode": proc.returncode,
        }
        status = "ok" if proc.returncode == 0 else "error"
        error = None if proc.returncode == 0 else proc.stderr[-1000:]
    except subprocess.TimeoutExpired:
        result = {"stdout": "", "stderr": "execution exceeded 15s", "returncode": -1}
        status = "timeout"
        error = "timeout"

    db = _sync_session()
    try:
        db.execute(
            update(CodeRun)
            .where(CodeRun.id == UUID(run_id))
            .values(status=status, result=result, error=error, finished_at=datetime.now(timezone.utc))
        )
        db.commit()
    finally:
        db.close()

    return {"run_id": run_id, "status": status, "started_at": started.isoformat()}
