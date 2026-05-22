# Frontend

Next.js 14 (app router) + Tailwind + Pyodide.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Visit http://localhost:3000.

## Notable files

- `src/workers/pyodide.worker.ts`: the sandboxed Python runtime. Loads Pyodide from CDN, persists a single interpreter across cells, patches `matplotlib.pyplot.show()` to capture figures as base64 PNG.
- `src/hooks/useStreamingChat.ts`: SSE client over `fetch` (lets us send the `Authorization` header, which `EventSource` cannot).
- `src/hooks/useNotebookRuntime.ts`: React-friendly wrapper around the worker; tracks per-cell outputs and running state.
- `src/lib/cells.ts`: parses fenced ```python blocks from the LLM stream into renderable cells.

## Auth model

JWT lives in `localStorage` under `nbc.token`. Every API call attaches it as `Authorization: Bearer ...`. There's no refresh-token flow yet. For a starter, a 7-day token is good enough; for production, add a refresh endpoint and rotate.
