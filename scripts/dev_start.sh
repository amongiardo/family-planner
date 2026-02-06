#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
PID_DIR="$ROOT_DIR/.dev_pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

PG_BIN="/Library/PostgreSQL/18/bin"
PG_CTL="${PG_BIN}/pg_ctl"
PG_ISREADY="${PG_BIN}/pg_isready"
PG_DATA="/Library/PostgreSQL/18/data"

if [[ -x "$PG_ISREADY" ]]; then
  if ! "$PG_ISREADY" -q; then
    echo "Starting PostgreSQL (may prompt for sudo)..."
    sudo -u postgres "$PG_CTL" -D "$PG_DATA" start
  else
    echo "PostgreSQL is already running."
  fi
else
  echo "pg_isready not found at $PG_ISREADY. Skipping PostgreSQL start."
fi

echo "Starting backend..."
cd "$ROOT_DIR/backend"
nohup npm run dev > "$LOG_DIR/backend.log" 2>&1 &
echo $! > "$PID_DIR/backend.pid"

echo "Starting frontend..."
cd "$ROOT_DIR/frontend"
nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$PID_DIR/frontend.pid"

echo "All services started."
