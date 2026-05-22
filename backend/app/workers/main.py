"""Entrypoint for `rq worker`.

    rq worker --url $REDIS_URL code_runs
"""

from app.workers.queue import get_queue  # noqa: F401
from app.workers.run_executor import execute  # noqa: F401
