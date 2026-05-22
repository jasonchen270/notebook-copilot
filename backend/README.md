# Backend

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env
# fill in ANTHROPIC_API_KEY

# in another terminal, start postgres + redis
docker compose -f ../docker/docker-compose.yml up

uvicorn app.main:app --reload
```

## Run the rq worker

```bash
rq worker --url $REDIS_URL code_runs
```

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | no | create account, returns JWT |
| POST | `/auth/login` | no | exchange creds for JWT |
| GET | `/auth/me` | yes | current user |
| GET | `/chat/sessions` | yes | list saved sessions |
| POST | `/chat/sessions` | yes | create a new session |
| GET | `/chat/sessions/{id}/messages` | yes | full message history |
| POST | `/chat/sessions/{id}/messages` | yes | send a message; **SSE stream** back |
| POST | `/files` | yes | multipart upload (50 MB cap) |
| GET | `/files` | yes | list user uploads |
| GET | `/files/{id}/raw` | yes | download a file |
| POST | `/runs` | yes | enqueue server-side execution (rare path) |
| GET | `/runs/{id}` | yes | poll a run result |
