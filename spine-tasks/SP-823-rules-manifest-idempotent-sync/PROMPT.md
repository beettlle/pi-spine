# Task: SP-823 — `spine rules sync` and `npm test` stop rewriting `.spine/rules-manifest.json`

**Created:** 2026-10-10
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Manifest writes feed rules selection, drift checks, and integrate merges. Skipping a write when the content really changed would leave a stale manifest.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** `discoverCursorRules` (`src/config/cursor-rules/discover.mjs` ~245-262) builds `generatedAt: new Date().toISOString()` and calls `writeRulesManifestAtomic` whenever `writeManifest` is set, even when nothing changed. `fingerprintRulesManifest` (same file, ~268) already ignores `generatedAt` but is only used for drift and merge checks. `tests/cli/spine-rules.test.mjs` ~156-160 runs `spine rules sync` against the real repo root, so every `npm test` dirties the tracked manifest. In v2.27.0 wave 2 this churn caused a lane merge conflict on the `generatedAt` line. The deprecated wrapper `tryAutoResolveRulesManifestMergeConflict` (`src/batch/engine-lanes/merge.mjs` ~497) only calls `tryAutoResolveMergeConflicts(projectRoot, {})`. It is still imported by `src/batch/integrate-worktree.mjs` (line 12, used ~432) and re-exported from `src/batch/engine-lanes.mjs` (~60). Line caps: `integrate-worktree.mjs` 498 and `engine-lanes.mjs` 498 lines (batch module limit 500), so changes there must not add lines.

## Mission

Closes #315 — An unchanged rules set never rewrites the manifest, `npm test` leaves `git status` clean for it, and the deprecated wrapper is gone.

1. **Idempotent write** (`src/config/cursor-rules/discover.mjs`): when `writeManifest` is set, read the existing manifest (if present and parseable). When `fingerprintRulesManifest(existing) === fingerprintRulesManifest(next)`, skip the write, keep the existing `generatedAt` in the returned manifest, and still return `manifestPath`. An unreadable or invalid existing file falls through to a normal write.
2. **CLI test isolation** (`tests/cli/spine-rules.test.mjs`): the `spine rules sync via CLI` test runs in a temp git repo (`initGitRepo` / `destroyGitRepo` from `tests/helpers/git-fixture.mjs`) with a copy of the repo's `.cursor/rules`, not in `REPO_ROOT`. Keep its assertions.
3. **Remove the deprecated wrapper**: replace the call in `integrate-worktree.mjs` with `tryAutoResolveMergeConflicts(worktreePath, {})` (swap the import; no net added lines), drop the re-export in `engine-lanes.mjs`, delete the wrapper in `merge.mjs`, and point `tests/batch/rules-manifest-merge.test.mjs` at `tryAutoResolveMergeConflicts`.
4. **Tests** — add to `tests/config/cursor-rules/discover.test.mjs`: sync twice with unchanged rules in a temp dir → the file bytes are identical and `generatedAt` is unchanged; change one rule → the file is rewritten with a new fingerprint.

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient`, which reviews this task's diff with stet (`.review/config.toml`: `qwen/qwen3.8-27b` on LM Studio with the OpenJev critic). When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>` (`false_positive`, `already_correct`, `wrong_suggestion`, `out_of_scope`), citing lint/typecheck/test evidence. Record stet reviewer bugs (invented syntax errors, stale hunks, parse failures) under Discoveries in STATUS.md. Never dismiss a real defect without fixing it. If stet itself fails (`stet doctor`), record a blocker; do not edit `.review/`.

## Dependencies

- **Task:** SP-828 (stet contract script and review config used by this Contract)

## Context to Read First

- GitHub #315
- `src/config/cursor-rules/discover.mjs` 200-290
- `src/batch/engine-lanes/merge.mjs` 310-340 and 490-500; `src/batch/integrate-worktree.mjs` 1-20 and 420-445; `src/batch/engine-lanes.mjs` 50-70
- `tests/cli/spine-rules.test.mjs` 130-165; `tests/helpers/git-fixture.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) and OpenJev System One at `http://127.0.0.1:8080`, for the stet step of the Contract only (unit tests need neither)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/config/cursor-rules/discover.mjs`
- `src/batch/integrate-worktree.mjs`
- `src/batch/engine-lanes.mjs`
- `src/batch/engine-lanes/merge.mjs`
- `tests/cli/spine-rules.test.mjs`
- `tests/config/cursor-rules/discover.test.mjs`
- `tests/batch/rules-manifest-merge.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/config/cursor-rules/discover.test.mjs tests/cli/spine-rules.test.mjs tests/batch/rules-manifest-merge.test.mjs tests/doctor/rules-manifest.test.mjs tests/batch/integrate-worktree-sync.test.mjs tests/batch/integrate-fast-forward.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh lenient` |
| fileScopeMustChange | `src/config/cursor-rules/discover.mjs`, `src/batch/engine-lanes/merge.mjs`, `tests/cli/spine-rules.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `discoverCursorRules` and `tryAutoResolveRulesManifestMergeConflict` — record callers in Discoveries
- [ ] `rg -n 'tryAutoResolveRulesManifestMergeConflict|rules", "sync"|REPO_ROOT' src bin tests` — every remaining caller is in File Scope (record any others as a blocker)
- [ ] Record line counts of `integrate-worktree.mjs` and `engine-lanes.mjs`
- [ ] Dependencies satisfied

### Step 1: Idempotent write

- [ ] Fingerprint guard in `discoverCursorRules`

**Artifacts:**
- `src/config/cursor-rules/discover.mjs` (modified)

### Step 2: Remove the wrapper

- [ ] Call site, re-export, wrapper, and test updated

**Artifacts:**
- `src/batch/integrate-worktree.mjs` (modified)
- `src/batch/engine-lanes.mjs` (modified)
- `src/batch/engine-lanes/merge.mjs` (modified)
- `tests/batch/rules-manifest-merge.test.mjs` (modified)

### Step 3: Tests

- [ ] CLI test in a temp repo
- [ ] Idempotency cases

**Artifacts:**
- `tests/cli/spine-rules.test.mjs` (modified)
- `tests/config/cursor-rules/discover.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review; triage per Mission)
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] After `npm test`, `git status --porcelain .spine/rules-manifest.json` is empty (paste into Discoveries)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] `npm test` leaves `.spine/rules-manifest.json` unchanged
- [ ] `spine rules sync` with no rule changes does not modify the manifest
- [ ] The deprecated wrapper is removed

## Git Commit Convention

- `fix(SP-823): idempotent rules manifest sync; drop deprecated merge wrapper (#315)`

## Do NOT

- Remove the `generatedAt` merge special case in `merge.mjs` (#315 item 4 is evaluation only; out of scope)
- Change the manifest schema or `fingerprintRulesManifest`
- Edit `.spine/rules-manifest.json` or anything else under `.spine/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- **2026-10-11 (operator, SP-828 stet adoption):** Contract `testCommand` ends with `bash scripts/spine-stet-contract-run.sh lenient`; added `fileScopeMustNotChange` `.review/**`, the LM Studio and OpenJev services, the stet triage paragraph in Mission, and the dependency on SP-828.
