# Vue app (`apps/web`)

Vue 3 + TypeScript + Vite + Tailwind. Talks to the Nest API at `VITE_API_URL`.

From the repo root (recommended — Vite HMR via Docker):

```bash
docker compose up --build
```

Web: http://localhost:5173 — edits under `apps/web/src` reload in the browser.

To run Vite on the host instead:

```bash
cp .env.example .env
pnpm --filter web dev
```

The API must allow `CORS_ORIGIN=http://localhost:5173`.
