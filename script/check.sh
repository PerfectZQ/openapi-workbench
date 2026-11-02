#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
go_bin="${GO_BIN:-go}"
go_format="$(dirname "$(command -v "$go_bin")")/gofmt"
unformatted="$("$go_format" -l explorer.go cmd contract sdkgen test)"
if [[ -n "$unformatted" ]]; then
  echo "Go 文件需要格式化：$unformatted" >&2
  exit 1
fi
npm --prefix frontend run build
"$go_bin" test ./...
npm --prefix frontend test
git diff --check
