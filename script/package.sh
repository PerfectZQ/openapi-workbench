#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
release_tag="${1:?用法：script/package.sh vX.Y.Z}"
node --input-type=module - "$release_tag" <<'JS'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const tag = process.argv[2]
assert.match(tag, /^v\d+\.\d+\.\d+$/)
for (const path of ['frontend/package.json', 'frontend/packages/ui/package.json']) {
  assert.equal(`v${JSON.parse(readFileSync(path, 'utf8')).version}`, tag, `${path} 与 tag 不一致`)
}
const lock = JSON.parse(readFileSync('frontend/package-lock.json', 'utf8'))
assert.equal(`v${lock.version}`, tag)
assert.equal(`v${lock.packages[''].version}`, tag)
assert.equal(`v${lock.packages['packages/ui'].version}`, tag)
JS
release_dir="$(pwd)/.artifacts/release"
mkdir -p "$release_dir"
npm --prefix frontend pack ./frontend --ignore-scripts --pack-destination "$release_dir"
npm pack ./frontend/packages/ui --ignore-scripts --pack-destination "$release_dir"
mv "$release_dir/api-explorer-react-${release_tag#v}.tgz" "$release_dir/api-explorer-react.tgz"
mv "$release_dir/workbench-ui-${release_tag#v}.tgz" "$release_dir/workbench-ui.tgz"
(cd "$release_dir" && shasum -a 256 api-explorer-react.tgz workbench-ui.tgz > SHA256SUMS)
echo "Release 产物：$release_dir"
