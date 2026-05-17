#!/usr/bin/env bash
# CCGS Command Center launcher.
#   - Installs dependencies on first run
#   - Re-runs the data extractors (predev hook handles this)
#   - Starts the Vite dev server and opens it in the browser
#
# Usage: ./launch.sh           — dev mode (HMR, fast restart)
#        ./launch.sh preview   — production build + serve
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "✗ node is not installed. Install Node.js 20+ and try again." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "→ Installing dependencies (first run only)…"
  npm install
fi

mode="${1:-dev}"
case "$mode" in
  dev)
    echo "→ Starting dev server (browser will open automatically)…"
    exec npm run dev -- --open
    ;;
  preview)
    echo "→ Building production bundle…"
    npm run build
    echo "→ Serving preview (browser will open automatically)…"
    exec npm run preview -- --open
    ;;
  *)
    echo "Usage: $0 [dev|preview]" >&2
    exit 1
    ;;
esac
