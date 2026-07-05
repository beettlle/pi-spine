# Flutter lane worktree guide

How to run pi-spine batches on **Flutter** consumer repos when lane worktrees differ from your main developer checkout. Lane worktrees are provisioned from **git only** — gitignored assets and stale `build/` artifacts that exist on your main tree are absent or polluted in `.worktrees/spine-<batchId>/lane-N`.

**Related issues:** [#78](https://github.com/beettlle/pi-spine/issues/78) (analyzer pollution), [#80](https://github.com/beettlle/pi-spine/issues/80) (gitignored pubspec assets). Engine-side fixes are tracked separately ([SP-458](https://github.com/beettlle/pi-spine/issues/78), [SP-459](https://github.com/beettlle/pi-spine/issues/80)); this guide documents operator workarounds until those land.

**See also:** [Cross-model PROMPT authoring](./operator-runbook.md#cross-model-prompt-authoring-issue-84) (scoped `testCommand`), [bootstrap checklist](./bootstrap-checklist.md), [contract-template § Cross-model](../../skills/create-spine-tasks/references/contract-template.md#cross-model-authoring-worker--reviewer).

---

## Why lane worktrees fail Flutter verification

| Symptom | Typical cause | Contract phase |
|---------|---------------|----------------|
| `unable to find directory entry in pubspec.yaml: .../assets/...` | `pubspec.yaml` lists asset dirs that are **gitignored** and built locally on main checkout only | `flutter test` |
| `flutter analyze` errors in `build/ios/SourcePackages/...` or `build/macos/SourcePackages/...` | Stale **build artifacts** copied or left in lane worktree; analyzer scans example apps with missing deps | `flutter analyze` |
| `review_exhausted` / `contract_failed` after green worker `.DONE` | Broad Contract `testCommand` (`flutter test`, `flutter analyze && flutter test`) fails in lane env while targeted worker tests passed | Final contract verify |

Lane worktrees are **not** identical to the developer checkout. Pre-existing full-suite failures, missing assets, and build pollution cause unscoped `testCommand` to fail at final verify even when the worker delivered correct code.

---

## Recommended setup (three layers)

Use all three for reliable Flutter batches:

1. **`worktreeSetupHook`** — symlink gitignored assets from main checkout; optionally clean `build/` before worker/verify runs.
2. **Scoped Contract `testCommand`** — match the PROMPT Testing step; avoid full-tree `flutter analyze` and unscoped `flutter test`.
3. **PROMPT File Scope** — keep tasks narrow so verification stays lane-safe.

---

## 1. Gitignored pubspec assets (#80)

### Problem

Flutter `pubspec.yaml` often references asset directories that are **generated or downloaded locally** and listed in `.gitignore` (plugins, bundled skins, downloaded models). They exist on the operator's main checkout but **not** in `git worktree` checkouts.

Example failure:

```text
Error: unable to find directory entry in pubspec.yaml: .../lane-1/assets/plugins/dye2.reaplugin/
Error: unable to find directory entry in pubspec.yaml: .../lane-1/assets/bundled_skins/
```

### Workaround: symlink from `SPINE_PROJECT_ROOT`

pi-spine runs `worktreeSetupHook` once per lane after worktree provision. The hook receives:

| Variable | Value |
|----------|-------|
| `SPINE_PROJECT_ROOT` | Main project checkout (where you run `spine batch start`) |
| `SPINE_WORKTREE` | Lane worktree path (`.worktrees/spine-<batchId>/lane-N`) |
| `SPINE_BATCH_ID` | Active batch id |
| `SPINE_LANE_NUMBER` | Lane index |

Symlink gitignored asset paths from the main checkout into the lane worktree:

```bash
# Inside your hook script (runs with cwd = lane worktree)
ROOT="${SPINE_PROJECT_ROOT:?SPINE_PROJECT_ROOT unset}"
WT="$(pwd)"

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

link_asset "assets/bundled_skins"
link_asset "assets/plugins/dye2.reaplugin"
```

**Requirements:**

- Hook path must be **relative**, under `scripts/` (e.g. `scripts/spine-worktree-setup-flutter.sh`).
- Last line of stdout must be JSON: `{"ok":true}`.
- Hook timeout: **120 seconds** (FR-WT-05).

Copy the optional template from pi-spine: [`templates/spine-worktree-setup-flutter.sh`](../../templates/spine-worktree-setup-flutter.sh).

Wire in `.spine/spine-config.json`:

```json
"worktreeSetupHook": "scripts/spine-worktree-setup-flutter.sh"
```

**Symlink drift:** If workers or tooling delete hook-managed symlinks, pi-spine re-runs the hook before the lane dirty gate and ignores deletion-only drift when a hook is configured ([SP-429](https://github.com/beettlle/pi-spine/issues/87)). See [operator runbook — DirtyWorktree symlink drift](./operator-runbook.md#common-batch-failures).

---

## 2. Analyzer pollution from `build/` (#78)

### Problem

Lane worktrees may contain `build/ios/SourcePackages/...` or `build/macos/SourcePackages/...` with Firebase or other example apps. `flutter analyze` (default: entire project tree) reports errors in those paths and exits non-zero — even when `lib/` and `test/` are clean.

Same command on a clean main checkout (no polluted `build/`) may pass.

### Workarounds

**Option A — Clean `build/` in the setup hook (recommended for doc/fixture tasks):**

```bash
rm -rf build
```

Add to the same `worktreeSetupHook` script after asset symlinks (see template).

**Option B — Scope analyze in Contract `testCommand`:**

```bash
flutter analyze lib test && flutter test test/unit/my_feature_test.dart
```

Avoid bare `flutter analyze` when `build/` may contain platform artifacts.

**Option C — Exclude in `analysis_options.yaml` (repo-wide):**

```yaml
analyzer:
  exclude:
    - build/**
```

Prefer Option A or B for spine batches so Contract verify matches operator intent without changing global analyzer config.

---

## 3. Scoped Contract `testCommand`

### Avoid

| Command | Why it fails in lanes |
|---------|----------------------|
| `flutter test` | Full suite; missing gitignored assets; pre-existing failures |
| `flutter analyze && flutter test` | Analyzer scans polluted `build/`; test hits missing assets |
| Same as global `testing.test` without lane verification | Main checkout ≠ lane worktree |

### Prefer

| Task type | Example `testCommand` |
|-----------|------------------------|
| Docs-only | `` `true` `` + `fileScopeMustChange` on deliverable paths |
| Single feature | `` `flutter test test/unit/services/foo_test.dart` `` |
| Analyze + test (scoped) | `` `flutter analyze lib test && flutter test test/widget_test.dart` `` |
| With setup hook + clean build | `` `flutter test test/unit/foo_test.dart` `` (hook handles assets/build) |

Align **PROMPT Testing step** and **Contract `testCommand`** — reviewers and contract verify run the Contract value, not ad-hoc worker commands.

**Output limits:** Full `flutter test` can exceed contract verify `maxBuffer` (10 MB). Prefer scoped test files ([#86](https://github.com/beettlle/pi-spine/issues/86)).

---

## Bootstrap checklist (Flutter repos)

After [greenfield bootstrap](./bootstrap-checklist.md):

1. Copy [`templates/spine-worktree-setup-flutter.sh`](../../templates/spine-worktree-setup-flutter.sh) → `scripts/spine-worktree-setup-flutter.sh` and edit `GITIGNORED_ASSET_PATHS`.
2. Set `worktreeSetupHook` in `.spine/spine-config.json`.
3. Author tasks with scoped `testCommand` (see [contract-template](../../skills/create-spine-tasks/references/contract-template.md#cross-model-authoring-worker--reviewer)).
4. `spine doctor` — confirm hook path validates under `scripts/`.
5. Stub batch smoke: `SPINE_WORKER_STUB=1 spine batch start <task-id>` before real-pi.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Asset errors at `flutter test` | Main checkout has assets; hook lists correct paths; `SPINE_PROJECT_ROOT` set (run hook manually from lane cwd with env exported) |
| Analyze errors under `build/SourcePackages` | Add `rm -rf build` to hook or scope analyze to `lib test` |
| `contract_failed` after green worker | Narrow Contract `testCommand`; compare with PROMPT Testing step |
| `DirtyWorktree` with ` D assets/...` | Expected for symlink hooks — engine re-runs hook ([SP-429](https://github.com/beettlle/pi-spine/issues/87)) |
| Hook timeout | Keep hook under 120s; symlink only required paths |

**Manual hook test** (from repo root, replace paths):

```bash
export SPINE_PROJECT_ROOT="$(pwd)"
export SPINE_WORKTREE="$(pwd)/.worktrees/spine-test/lane-1"
mkdir -p "$SPINE_WORKTREE"
scripts/spine-worktree-setup-flutter.sh
# Last stdout line must be {"ok":true}
```

---

## Future engine work (not required for adoption)

| Issue | Task | Scope |
|-------|------|-------|
| [#78](https://github.com/beettlle/pi-spine/issues/78) | SP-458 | Optional engine/template for analyzer hygiene |
| [#80](https://github.com/beettlle/pi-spine/issues/80) | SP-459 | `spine init` template hook for gitignored assets |

This guide **partially** addresses #78 and #80; close those issues when engine tasks land or when your repo no longer needs the documented workarounds.
