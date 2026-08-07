# Deploying to Render

`render.yaml` at the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec)
that provisions the whole stack in one pass: the backend (FastAPI, Docker),
the frontend (Next.js, Docker), a managed Postgres database, and a managed
Redis instance.

It's written against Render's documented blueprint schema but hasn't been
validated against a live deploy (this repo has no Render account attached).
If "Apply" reports a schema error on a specific field, that error is more
trustworthy than anything below -- fix the flagged line and retry.

## One-time setup

1. Push this repo to GitHub (already done if you're reading this from the
   `claude/port-operations-copilot-mvp-zaq5lw` branch).
2. In the [Render dashboard](https://dashboard.render.com): **New +** ->
   **Blueprint** -> connect your GitHub account if you haven't -> select
   this repo and the branch to deploy from.
3. Render reads `render.yaml` and shows a plan: 2 web services
   (`port-copilot-backend`, `port-copilot-frontend`), 1 Postgres database
   (`port-copilot-db`), 1 Redis instance (`port-copilot-redis`). Click
   **Apply**.
4. First deploy takes a few minutes (installs OR-Tools/XGBoost, builds the
   Next.js production bundle). Watch the build logs for each service in
   the dashboard.

## Manual steps the blueprint can't do for you

- **`ANTHROPIC_API_KEY`** -- set this on `port-copilot-backend` in the
  Render dashboard (Environment tab). It's deliberately excluded from
  `render.yaml` (`sync: false`) so it never ends up in git. Without it,
  the copilot runs in retrieval-only mode, which still works.
- **Verify the frontend's backend URL.** `render.yaml` sets
  `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` on the frontend to
  `https://port-copilot-backend.onrender.com` / `wss://...`, assuming
  Render grants the backend service exactly that hostname. Check the
  backend service's actual URL in the dashboard after first deploy -- if
  it differs (e.g. Render appended a suffix because the name was taken),
  update those two env vars on the frontend service and trigger a manual
  redeploy (Next.js inlines `NEXT_PUBLIC_*` at build time, so a redeploy,
  not just a restart, is required for a changed value to take effect).
- **Update `BACKEND_CORS_ORIGINS`** on the backend the same way if the
  frontend's actual URL differs from the assumed one.

## Plan sizing

Every service in `render.yaml` defaults to Render's `starter` plan
(paid, no idle sleep) rather than `free`. This is deliberate: Render's free
web services spin down after ~15 minutes idle and take 30-50s to wake on
the next request -- fine for a side project, bad if an investor or a port
operator clicks your link cold during a pitch. If cost matters more than
that right now, switch a service's `plan:` to `free` in `render.yaml`
before applying (Postgres free tier also auto-expires after 30 days, which
`starter` avoids).

## After deploying

- Backend health check: `https://<backend-url>/health`
- API docs: `https://<backend-url>/docs`
- Frontend: `https://<frontend-url>`
- Sign up for an account on the frontend to create your first organization,
  then run a simulation from the dashboard.

## Redeploying

Render auto-deploys on push to the connected branch by default. To ship a
change: commit, push, and Render picks it up -- no separate deploy step.
