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
      # Kill child processes first (npm spawns node)
      if command -v pgrep >/dev/null 2>&1; then
        pgrep -P "$pid" | xargs -r kill 2>/dev/null || true
      fi
      kill "$pid" 2>/dev/null || true
      # Give it a moment, then force if still alive
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$pid_file"
  fi
}

stop_pid "frontend"
stop_pid "backend"

# Clean up any lingering node processes on dev ports (fallback)
for port in 3000 3001 3002 3003; do
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:${port} -sTCP:LISTEN -c node 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "Killing node processes on port $port: $pids"
      kill $pids 2>/dev/null || true
    fi
  fi
done

PG_BIN="/Library/PostgreSQL/16/bin"
PG_CTL="${PG_BIN}/pg_ctl"
PG_DATA="/Library/PostgreSQL/16/data"

if [[ -x "$PG_CTL" ]]; then
  echo "Stopping PostgreSQL (may prompt for sudo)..."
  sudo -u postgres "$PG_CTL" -D "$PG_DATA" stop
fi

echo "All services stopped."
