#!/usr/bin/env bash
set -euo pipefail
tests=(
  tests/backup.service.test.mjs
  tests/dbMutation.test.mjs
  tests/domain-regressions.test.mjs
  tests/firestore.state.test.mjs
  tests/firestore.conflict.test.mjs
  tests/inventory.rules.test.mjs
  tests/masterdata.rules.test.mjs
  tests/permissions.service.test.mjs
  tests/purchasing.service.test.mjs
  tests/referentialIntegrity.service.test.mjs
  tests/sales.service.test.mjs
  tests/stats.service.test.mjs
  tests/utils.test.mjs
  tests/printing.test.mjs
  tests/browser-smoke.test.mjs
)
for file in "${tests[@]}"; do
  echo "▶ $file"
  timeout -k 2s 12s node --test --test-timeout=5000 "$file"
done
echo 'Test dominio completati con esito positivo.'
