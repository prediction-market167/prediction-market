FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Write entrypoint inline — avoids CRLF issues from Windows-authored .sh files
RUN printf '#!/bin/sh\n\
echo "[startup] Running migrations..."\n\
alembic upgrade head\n\
STATUS=$?\n\
[ $STATUS -ne 0 ] && echo "[startup] WARNING: migration exited $STATUS"\n\
echo "[startup] Starting uvicorn on port ${PORT:-8000}..."\n\
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers\n' \
    > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

CMD ["/bin/sh", "/app/entrypoint.sh"]
