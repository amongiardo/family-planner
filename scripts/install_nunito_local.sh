#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
TARGET_DIR="$FRONTEND_DIR/src/app/fonts/nunito"

if ! command -v npm >/dev/null 2>&1; then
  echo "Errore: npm non trovato nel PATH."
  exit 1
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "[1/4] Download pacchetto @fontsource/nunito..."
cd "$TMP_DIR"
npm pack @fontsource/nunito >/dev/null

TARBALL="$(ls -1 fontsource-nunito-*.tgz | head -n1)"
if [[ -z "${TARBALL:-}" ]]; then
  echo "Errore: tarball @fontsource/nunito non trovato."
  exit 1
fi

echo "[2/4] Estrazione pacchetto..."
tar -xzf "$TARBALL"

mkdir -p "$TARGET_DIR"

echo "[3/4] Copia font .woff2 (latin normal 400/600/700/800)..."
for weight in 400 600 700 800; do
  src="package/files/nunito-latin-${weight}-normal.woff2"
  dst="$TARGET_DIR/nunito-latin-${weight}-normal.woff2"

  if [[ ! -f "$src" ]]; then
    echo "Errore: file atteso non trovato: $src"
    echo "File disponibili nel pacchetto:"
    ls package/files | grep -i "nunito" | head -n 50 || true
    exit 1
  fi

  cp "$src" "$dst"
done

echo "[4/4] Completato. Font installati in: $TARGET_DIR"
ls -1 "$TARGET_DIR"

echo

echo "Prossimo step: aggiornare frontend/src/app/layout.tsx a next/font/local."
