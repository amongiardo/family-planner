#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

RUN_RESTART=true
if [[ "${1:-}" == "--no-restart" ]]; then
  RUN_RESTART=false
fi

echo "[1/5] Verifica PostgreSQL..."
PG_BIN="/Library/PostgreSQL/16/bin"
PG_CTL="${PG_BIN}/pg_ctl"
PG_ISREADY="${PG_BIN}/pg_isready"
PG_DATA="/Library/PostgreSQL/16/data"

if [[ -x "$PG_ISREADY" ]]; then
  if ! "$PG_ISREADY" -q; then
    echo "PostgreSQL non attivo: avvio in corso (potrebbe chiedere sudo)..."
    sudo -u postgres "$PG_CTL" -D "$PG_DATA" start
  else
    echo "PostgreSQL attivo."
  fi
else
  echo "pg_isready non trovato in $PG_ISREADY (continuo comunque)."
fi

echo "[2/5] Applico migrazioni Prisma (deploy)..."
cd "$BACKEND_DIR"
npx prisma migrate deploy

echo "[3/5] Rigenero Prisma Client..."
npx prisma generate

echo "[4/5] Build backend di verifica..."
npm run build

if [[ "$RUN_RESTART" == "true" ]]; then
  echo "[5/5] Riavvio stack dev (stop/start)..."
  cd "$ROOT_DIR"
  ./scripts/dev_stop.sh || true
  ./scripts/dev_start.sh
else
  echo "[5/5] Riavvio saltato (--no-restart)."
fi

echo "Update locale completato."
