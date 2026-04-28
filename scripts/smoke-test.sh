#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Forge smoke tests =="

run_pi_ext() {
  local name="$1"
  local ext="$2"
  local prompt="$3"
  echo "-- $name"
  pi -p --no-session --no-extensions -e "$ROOT/$ext" "$prompt" >/tmp/forge-smoke-$name.out
  cat /tmp/forge-smoke-$name.out
}

run_pi_ext "core" "packages/forge-core/extensions/forge-core/index.ts" "Say forge-core smoke ok."
run_pi_ext "design" "packages/forge-design-studio/extensions/design-pipeline/index.ts" "Say forge-design smoke ok."
run_pi_ext "mobile" "packages/forge-mobile-dev/extensions/forge-mobile/index.ts" "Say forge-mobile smoke ok."

echo "-- forge tools"
pi -p --no-session --no-extensions -e "$ROOT/packages/forge-core/extensions/forge-core/index.ts" \
  "List Forge tools only. Include forge_doctor if available." >/tmp/forge-smoke-tools.out
cat /tmp/forge-smoke-tools.out

echo "== Forge smoke tests passed =="
