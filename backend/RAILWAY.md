# Railway Deployment Guide

## 1 — Create the project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select `prediction-market167/prediction-market`
3. When Railway asks which service to deploy, select the repo root for now (you will set the root directory in the next step)

---

## 2 — Set the root directory

Railway must build from `backend/`, not the repo root.

1. Open the backend service → **Settings** tab
2. Under **Source** → **Root Directory**, enter `backend`
3. Save — Railway will re-detect the build config and find `railway.json` and `nixpacks.toml`

---

## 3 — Add a PostgreSQL database

1. In your Railway project, click **+ New** → **Database** → **Add PostgreSQL**
2. Railway creates a Postgres instance and exposes these variables to your project:
   - `DATABASE_URL` — full connection string (auto-linked to your service)
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

Link the database to the backend service:

1. Open the backend service → **Variables** tab
2. Click **+ Add Variable Reference**
3. Select `DATABASE_URL` from the Postgres service

> The app automatically rewrites `postgresql://` → `postgresql+asyncpg://` at startup, so you do not need to modify the URL Railway provides.

---

## 4 — Add a Redis database (optional — needed for Celery)

1. Click **+ New** → **Database** → **Add Redis**
2. Link `REDIS_URL` from the Redis service to the backend service the same way as above

If you skip Redis, set `REDIS_URL` manually to disable Celery workers:

```
REDIS_URL=redis://localhost:6379/0
```

---

## 5 — Set required environment variables

In the backend service → **Variables** tab, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `SECRET_KEY` | `<random 64-char hex>` | Run `openssl rand -hex 32` locally to generate |
| `APP_ENV` | `production` | |
| `DEBUG` | `False` | |
| `ALLOWED_ORIGINS` | `["https://your-frontend-domain.com"]` | JSON array; use Railway frontend URL |

Generate a secret key:
```bash
openssl rand -hex 32
```

---

## 6 — Set optional environment variables

| Variable | Value | Notes |
|----------|-------|-------|
| `DEPOSIT_TON_ADDRESS` | `UQ...` | Your TON wallet address for deposits |
| `TELEGRAM_BOT_TOKEN` | `123456:ABC...` | From @BotFather |
| `TELEGRAM_BOT_USERNAME` | `your_bot` | Without the @ |
| `MINI_APP_URL` | `https://your-frontend-domain.com` | |
| `WEBHOOK_URL` | `https://your-backend.railway.app/api/v1/telegram/webhook` | |

---

## 7 — Deploy

Once all variables are set, click **Deploy** (or push to `master` — Railway redeploys automatically on every push).

Railway will:
1. Build the app with Nixpacks (Python 3.12 + system libs)
2. Run `pip install -r requirements.txt`
3. On start: run `alembic upgrade head` then launch `uvicorn`

Check the **Deploy Logs** tab — a successful start looks like:

```
INFO  [alembic.runtime.migration] Running upgrade ...
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:PORT
```

The `/health` endpoint is used as the healthcheck. Once it returns `200`, the deployment is marked as live.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails — `gcc not found` | Confirm `nixpacks.toml` is in `backend/` and root directory is set to `backend/` |
| `sqlalchemy.exc.ArgumentError: Could not parse rfc1738 URL` | `DATABASE_URL` is not set — re-link from the Postgres service |
| Healthcheck timeout | Migrations are taking too long on first deploy; increase `healthcheckTimeout` in `railway.json` |
| `connection refused` to Postgres | Postgres service is in a different Railway project — it must be in the same project |
| `ALLOWED_ORIGINS` CORS error | Value must be a valid JSON array string: `["https://example.com"]` |
