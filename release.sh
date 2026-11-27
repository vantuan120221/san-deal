#!/bin/bash
# Cập nhật version.json theo main.js (version lấy từ VERSION trong main.js + sha256)
set -e
cd "$(dirname "$0")"
V=$(grep -oP 'var VERSION = "\K[^"]+' main.js)
H=$(sha256sum main.js | cut -d' ' -f1)
printf '{\n  "version": "%s",\n  "sha256": "%s"\n}\n' "$V" "$H" > version.json
cat version.json
