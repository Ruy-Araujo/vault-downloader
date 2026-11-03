#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
output_dir="$project_dir/dist/vault-downloader"
archive="$project_dir/dist/vault-downloader.zip"
rm -rf "$output_dir"
mkdir -p "$output_dir"
cp "$project_dir"/{manifest.json,background.js,offscreen.html,offscreen.js,popup.html,popup.css,popup.js,page-collector.js,source-collectors.js,sources.js,cache-lifetime.js,shared.js,README.md} "$output_dir/"
rm -f "$archive"
(cd "$project_dir/dist" && zip -qr "$(basename "$archive")" "vault-downloader")
printf 'Package created: %s\n' "$archive"
