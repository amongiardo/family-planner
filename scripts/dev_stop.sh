#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT_DIR/.dev_pids"

stop_pid() {
  local name="$1"
  local pid_file="$PID_DIR/${name}.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $name (pid $pid)..."
      kill "$pid"
    fi
    rm -f "$pid_file"
  fi
}

stop_pid "frontend"
stop_pid "backend"

PG_BIN="/Library/PostgreSQL/16/bin"
PG_CTL="${PG_BIN}/pg_ctl"
PG_DATA="/Library/PostgreSQL/16/data"

if [[ -x "$PG_CTL" ]]; then
  echo "Stopping PostgreSQL (may prompt for sudo)..."
  sudo -u postgres "$PG_CTL" -D "$PG_DATA" stop
fi

echo "All services stopped."
