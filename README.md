# Notebook Copilot

An LLM-powered notebook assistant. Chat with a model, get streaming Python that runs in your browser, persist sessions across devices.

## Architecture

```
┌──────────────────────────┐         ┌──────────────────────────┐
│  Next.js 14 + Tailwind   │ ──SSE── │  FastAPI                 │
│  - Streaming chat UI     │         │  - Auth (JWT + bcrypt)   │
│  - In-browser notebook   │         │  - Chat sessions         │
│  - Pyodide Web Worker    │         │  - File uploads          │
│    (sandboxed exec)      │         │  - LLM proxy w/ streaming│
└──────────────────────────┘         └────────┬─────────┬───────┘
                                              │         │
                                       ┌──────▼──┐  ┌───▼────┐
                                       │Postgres │  │ Redis  │
                                       │(state)  │  │(queues)│
                                       └─────────┘  └────────┘
```

The Python runtime is **Pyodide running inside a Web Worker** on the client. Code never executes server-side, which removes the largest class of security risk from "run LLM-generated code" products.

The backend owns durable state: user accounts, saved chat threads, uploaded files (parquet/csv ingested then served to the worker), and a Redis-backed queue for any job that genuinely needs to run server-side (large dataset profiling, scheduled cells, etc.).

## Local development

```bash
docker compose -f docker/docker-compose.yml up   # postgres + redis
cd backend && uvicorn app.main:app --reload      # api on :8000
cd frontend && npm run dev                       # ui on :3000
```

Set the LLM provider key in `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=change-me-in-prod
DATABASE_URL=postgresql+asyncpg://copilot:copilot@localhost:5432/copilot
REDIS_URL=redis://localhost:6379/0
```

## Project layout

- `backend/app/api/`: route handlers (auth, chat, files, runs)
- `backend/app/services/`: LLM client, code-run orchestration
- `backend/app/workers/`: Redis worker entrypoints (rq)
- `frontend/src/app/`: Next.js app router pages
- `frontend/src/workers/pyodide.worker.ts`: sandboxed Python runtime
- `frontend/src/components/`: Chat, NotebookCell, MessageStream
