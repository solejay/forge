#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/bump-version.sh <version>" >&2
  echo "Example: scripts/bump-version.sh 0.2.0" >&2
  exit 1
fi

VERSION="$1"
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid semver version: $VERSION" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node - "$ROOT" "$VERSION" <<'NODE'
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const version = process.argv[3];
const files = [
  'package.json',
  'packages/forge-core/package.json',
  'packages/forge-design-studio/package.json',
  'packages/forge-mobile-dev/package.json',
];

for (const rel of files) {
  const file = path.join(root, rel);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.version = version;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  console.log(`Updated ${rel} -> ${version}`);
}
NODE

echo "Version bump complete. Review changes, update CHANGELOG.md, run npm run smoke, then commit/tag."
