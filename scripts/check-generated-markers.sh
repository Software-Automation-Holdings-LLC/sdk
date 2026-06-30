#!/usr/bin/env bash
set -euo pipefail

# Mirror-side guard for SDK policy §12: generated artifacts must keep their codegen
# banners. Full regeneration-diff runs upstream in isa-platform where sources exist.
readonly marker_pattern='DO NOT EDIT|do not hand-edit|Code generated'

fail=0

check_files() {
  local -r glob="$1"
  local f
  while IFS= read -r -d '' f; do
    if ! grep -qE "${marker_pattern}" "${f}"; then
      echo "missing codegen banner: ${f}" >&2
      fail=1
    fi
  done < <(find . -path "./.git" -prune -o -type f -name "${glob}" -print0)
}

check_files '*.pb.go'
check_files '*.connect.go'

if [[ "${fail}" -ne 0 ]]; then
  exit 1
fi

echo "generated-marker guard OK"
