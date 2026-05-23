# Notebook Copilot

An LLM-powered notebook assistant: chat with a model, get streaming Python that runs in your browser, and persist sessions across devices. The backend is a FastAPI service backed by PostgreSQL and Redis, and the frontend is a Next.js app.

## Prerequisites

- Python 3.11+
- Node 20+
- PostgreSQL 16
- Redis 7

## Installation

Start Postgres and Redis, then configure the backend environment in `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=change-me-in-prod
DATABASE_URL=postgresql+asyncpg://copilot:copilot@localhost:5432/copilot
REDIS_URL=redis://localhost:6379/0
```

## Usage

```bash
docker compose -f docker/docker-compose.yml up   # postgres + redis
cd backend && uvicorn app.main:app --reload      # api on :8000
cd frontend && npm run dev                       # ui on :3000
```
