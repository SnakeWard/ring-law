#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "${0%/*}" && pwd)"
if [ "${OS:-}" = "Windows_NT" ]; then
  node scripts/start-local.mjs >/dev/null 2>&1 &
  exit 0
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
