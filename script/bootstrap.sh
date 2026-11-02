#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(node -p 'process.versions.node.split(".")[0]')" != 24 ]]; then
  echo '需要 Node.js 24' >&2
  exit 1
fi
git config --local core.hooksPath .githooks
git config --local commit.template .githooks/commit-template
git config --local pull.ff only
git config --local merge.ff only
npm --prefix frontend ci
