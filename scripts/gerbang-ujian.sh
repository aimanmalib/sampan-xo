#!/usr/bin/env bash
# Offline gate: typecheck + unit tests. No network, no secrets.
set -euo pipefail
cd "$(dirname "$0")/.."
# Git hooks export GIT_* variables that point at the real repository; tests must never see them.
while IFS= read -r v; do unset "$v"; done < <(env | grep -o '^GIT_[A-Z_]*' || true)
npx tsc --noEmit
npx vitest run --reporter=dot
