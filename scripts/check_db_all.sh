#!/usr/bin/env bash
set -euo pipefail

check_version() {
  local ver="$1"
  local pg_bin="/Library/PostgreSQL/${ver}/bin"
  local pg_data="/Library/PostgreSQL/${ver}/data"

  if [[ ! -x "${pg_bin}/pg_ctl" ]]; then
    echo "PostgreSQL ${ver} not found at ${pg_bin}"
    return 0
  fi

  echo "== Start PostgreSQL ${ver} =="
  sudo -u postgres "${pg_bin}/pg_ctl" -D "${pg_data}" start

  echo "== Databases (${ver}) =="
  PGPASSWORD="Antonio83" "${pg_bin}/psql" -p 5432 -U postgres -lqt || true

  echo "== Stop PostgreSQL ${ver} =="
  sudo -u postgres "${pg_bin}/pg_ctl" -D "${pg_data}" stop
}

check_version 18
check_version 16
