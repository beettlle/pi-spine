# Task: SP-881 — Exclude worker-usage.json from salvage and dirty scope

**Created:** 2026-11-21
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** worker-usage.json under the task folder is treated as in-scope dirty → salvage thrash / "1 uncommitted file(s) in scope" retry loops after v2.33.0.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** SP-879 writes spine-tasks/<task>/worker-usage.json. resolveScopedDirtyPaths / salvage include any porcelain path under the task folder. GITIGNORED_ARTIFACT_MARKERS does not list worker-usage.json, so even gitignored sidecars can be counted when not ignore-matched on older bases.

## Mission

Closes #380 — Engine-owned usage sidecars must not fail salvage or dirty-tree checks.

1. **Known artifact** — Treat `worker-usage.json` (basename, under task folders) as an engine artifact: exclude from `resolveScopedDirtyPaths` / salvage dirty lists, and add markers so `isGitignoredArtifactPath` / auto-clean paths recognize it (e.g. `/worker-usage.json` or `worker-usage.json` in `GITIGNORED_ARTIFACT_MARKERS`).
2. **Keep metrics** — Do **not** break `persistWorkerUsageSidecar` / `recordLaneTaskMetric` reading the sidecar; only stop treating it as product dirty.
3. **Repo hygiene** — Add `spine-tasks/**/worker-usage.json` to pi-spine `.gitignore` if missing so dogfood does not thrash.
4. **Tests** — Salvage/dirty unit coverage: a worktree with only `worker-usage.json` dirty under the task folder reports **0** salvageable dirty paths (or auto-cleans without failing the lane).

## Dependencies

- **None**

## Context to Read First

- GitHub #380
- `bin/spine-worker-runner.mjs` WORKER_USAGE_SIDECAR_FILENAME
- `src/batch/heartbeat.mjs` resolveScopedDirtyPaths
- `src/batch/salvage.mjs` inspectLaneSalvage
- `src/batch/lane-dirty-check.mjs` GITIGNORED_ARTIFACT_MARKERS / isGitignoredArtifactPath
- `src/batch/engine-lanes/queue.mjs` sidecar read in recordLaneTaskMetric

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/heartbeat.mjs`
- `src/batch/salvage.mjs`
- `src/batch/lane-dirty-check.mjs`
- `.gitignore`
- `tests/batch/salvage-inspect.test.mjs`
- `tests/batch/worker-usage-metrics.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/salvage-inspect.test.mjs tests/batch/worker-usage-metrics.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-881` |
| fileScopeMustChange | `src/batch/heartbeat.mjs`, `src/batch/lane-dirty-check.mjs`, `tests/batch/salvage-inspect.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Map resolveScopedDirtyPaths → salvage → diagnosis headline
- [ ] Confirm sidecar basename constant sync with runner/queue

### Step 1: Exclude sidecar from dirty/salvage

- [ ] Filter worker-usage.json from scoped dirty
- [ ] Add GITIGNORED_ARTIFACT_MARKERS (+ .gitignore if needed)
- [ ] Keep metric sidecar read working

### Step 2: Tests

- [ ] Only-sidecar dirty → not salvage-fail
- [ ] Existing usage metric tests still green

### Step 3: Testing & Verification

- [ ] Run Contract testCommand
- [ ] Fix failures

### Step 4: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create .DONE

- [ ] Create `spine-tasks/SP-881-worker-usage-sidecar-not-salvageable/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (dirty-tree / salvage / failure diagnosis)

## Completion Criteria

- [ ] Map resolveScopedDirtyPaths → salvage → diagnosis headline
- [ ] Confirm sidecar basename constant sync with runner/queue
- [ ] Filter worker-usage.json from scoped dirty
- [ ] Add GITIGNORED_ARTIFACT_MARKERS (+ .gitignore if needed)
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-881): exclude worker-usage.json from salvage dirty (#380)`

## Do NOT

- Remove or invent usage fields
- Rewrite usage emit path beyond excluding the sidecar from dirty/salvage
- Change journal payload shaping (#381 — SP-882)
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
