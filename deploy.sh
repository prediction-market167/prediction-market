#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker compose -f docker/docker-compose.prod.yml"

echo "▶ Pulling latest code..."
git pull origin main

echo "▶ Building images..."
$COMPOSE build --no-cache

echo "▶ Starting database..."
$COMPOSE up -d db redis
echo "  Waiting for Postgres to be ready..."
$COMPOSE run --rm backend sh -c "until pg_isready -h db -U \$POSTGRES_USER; do sleep 1; done"

echo "▶ Running database migrations..."
$COMPOSE run --rm backend alembic upgrade head

echo "▶ Starting all services..."
$COMPOSE up -d

echo "▶ Cleaning up dangling images..."
docker image prune -f

echo ""
echo "✓ Deployed. Services:"
$COMPOSE ps
