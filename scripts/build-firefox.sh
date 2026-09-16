#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."

major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$major" -lt 22 ]; then
  echo "Node.js 22 or newer is required, found $(node -v)" >&2
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
fi
echo "node $(node -v), pnpm $(pnpm --version)"

pnpm install --frozen-lockfile
pnpm zip:firefox

for file in dist/*-firefox.zip dist/*-sources.zip; do
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$file"; else sha256sum "$file"; fi
done
