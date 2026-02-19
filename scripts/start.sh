#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting server..."
exec uvicorn src.pcp_server.main:app --host 0.0.0.0 --port 8000
