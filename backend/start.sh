#!/bin/sh

echo "[startup] Checking database connectivity..."
python -c "
import os, asyncio, sys

async def wait_for_db():
    import asyncpg
    url = os.environ.get('DATABASE_URL', '')
    # asyncpg needs postgresql:// not postgresql+asyncpg://
    url = url.replace('postgresql+asyncpg://', 'postgresql://')
    for attempt in range(30):
        try:
            conn = await asyncpg.connect(url)
            await conn.close()
            print(f'[startup] Database ready (attempt {attempt + 1})', flush=True)
            return
        except Exception as e:
            print(f'[startup] Waiting for DB ({attempt + 1}/30): {e}', flush=True)
            await asyncio.sleep(2)
    print('[startup] WARNING: DB never became ready, proceeding anyway', flush=True)

asyncio.run(wait_for_db())
"

echo "[startup] Running Alembic migrations..."
alembic upgrade head
MIGRATION_STATUS=$?

if [ $MIGRATION_STATUS -ne 0 ]; then
    echo "[startup] WARNING: alembic exited with code $MIGRATION_STATUS"
else
    echo "[startup] Migrations complete."
fi

echo "[startup] Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
