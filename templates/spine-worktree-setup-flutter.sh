#!/usr/bin/env bash
# Optional worktreeSetupHook for Flutter repos with gitignored pubspec assets (#80)
# and build/ analyzer pollution (#78). Copy to scripts/ and customize paths.
#
# Wire in .spine/spine-config.json:
#   "worktreeSetupHook": "scripts/spine-worktree-setup-flutter.sh"
#
# pi-spine runs this once per lane (cwd = lane worktree, 120s timeout).
# Last stdout line MUST be JSON: {"ok":true}

set -euo pipefail

ROOT="${SPINE_PROJECT_ROOT:?SPINE_PROJECT_ROOT unset — hook must run from spine batch engine}"
WT="$(pwd)"

# Edit: space-separated paths relative to repo root (gitignored assets in pubspec.yaml).
GITIGNORED_ASSET_PATHS=(
  "assets/bundled_skins"
  "assets/plugins/dye2.reaplugin"
)

# Remove stale build artifacts so flutter analyze does not scan SourcePackages pollution (#78).
CLEAN_BUILD_DIR=true

link_asset() {
  local rel="$1"
  local src="${ROOT}/${rel}"
  local dest="${WT}/${rel}"
  if [[ -e "$src" ]]; then
    mkdir -p "$(dirname "$dest")"
    rm -f "$dest"
    ln -s "$src" "$dest"
  fi
}

if [[ "$CLEAN_BUILD_DIR" == "true" ]]; then
  rm -rf build
fi

for rel in "${GITIGNORED_ASSET_PATHS[@]}"; do
  link_asset "$rel"
done

echo '{"ok":true}'
