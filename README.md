# Notebook Copilot

An LLM-powered notebook assistant. Chat with a model, get streaming Python that runs in your browser, persist sessions across devices.

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
