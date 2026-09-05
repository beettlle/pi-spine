# SP-751: Matrix index env vars and matrixMaxParallel — Status

**Current Step:** 1
**Status:** 🔄 Step 1 in progress
**Last Updated:** 2026-09-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Map execute vs LLM row env injection points
- [x] Map where matrix row concurrency is capped today

**Findings:**
- Execute rows: `runMatrixSubLane` → `runShellInDir(worktreePath, command)` in `matrix.mjs` spawns `/bin/sh -c` with bare `process.env` → add optional `extraEnv` merge param.
- LLM rows: `runMatrixSubLane` → `runWorker` (worker-host.mjs) → `spawnWorkerHandle` → `spawnWorkerChild` → `buildWorkerChildEnv` (worker-spawn.mjs). No extra-env seam exists → thread additive optional `extraEnv` through the chain (defaults preserve existing behavior byte-for-byte).
- Concurrency: `runMatrixTaskOnLane` caps rows via `runConcurrent(matrix.rows, maxParallel, …)` and the global lane pool `acquireLaneSlot(state, maxParallel)`. `matrixMaxParallel` throttles via `min(matrixMaxParallel, maxParallel)` on the `runConcurrent` limit only; global pool semantics untouched.
- Contract `runCommand`/`testCommand` reject `$` (#268), so row scripts consume the env vars from helper scripts committed in fixtures — shapes test design.
- Impact: `buildWorkerChildEnv` upstream = HIGH (9 impacted) — mitigated by additive-only optional param; `runShellInDir` = LOW.

---

### Step 1: Env vars + matrixMaxParallel
**Status:** 🔄 In progress

- [ ] Inject five env vars for execute and LLM rows
- [ ] Parse and enforce `matrixMaxParallel`
- [ ] Tests for env injection and throttle capping

**Plan:**
1. `matrix.mjs`: `runShellInDir(cwd, command, extraEnv = null)` merges `{...process.env, ...extraEnv}`; new `buildMatrixRowEnv({ taskId, rowId, rowIndex, rowCount })` returning the 5 vars (`SPINE_MATRIX_JOB_ID`=parent task id, `SPINE_MATRIX_TASK_ID`=row id, `SPINE_MATRIX_TASK_INDEX`=0-based, `SPINE_MATRIX_TASK_COUNT`, `JOB_COMPLETION_INDEX` alias) or null when index/count absent.
2. `matrix-run.mjs`: `runMatrixSubLane` accepts `rowIndex`/`rowCount`; execute path passes env to `runShellInDir`, LLM path passes `extraEnv` to `runWorker`. New `resolveMatrixRowConcurrency({ matrixMaxParallel, maxParallel })` = `min(⌈matrixMaxParallel⌉ ≥ 1, global)`; `runMatrixTaskOnLane` reads parent contract, uses it as the `runConcurrent` limit (global pool stays `maxParallel`), journals `matrixMaxParallel`.
3. `parse-prompt.mjs`: `matrixMaxParallel` in `CONTRACT_FIELD_NAMES` + positive-int validation in `applyContractField`. `validate-contract.mjs`: `isContractTableEmpty` accounts for it.
4. `worker-spawn.mjs`/`worker-host.mjs`: additive optional `extraEnv` param on `buildWorkerChildEnv`, `spawnWorkerChild`, `spawnWorkerHandle`, `runWorker`.
5. Tests (matrix-execution.test.mjs): `buildMatrixRowEnv` shape; `runShellInDir` injection + back-compat; `resolveMatrixRowConcurrency` caps; `buildWorkerChildEnv` extraEnv present/absent; E2E execute rows write env values to out files; E2E `matrixMaxParallel: 1` serializes rows (journal timestamps); LLM row env observed via `development.workerLaunchScript` env-dump script. contract-matrix-subst.test.mjs: parse valid/invalid `matrixMaxParallel`, per-row passthrough, no unknown-field warning.

---

### Step 2: Testing & Verification
**Status:** ⚪ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Not Started

- [ ] Update runbook §2.4
- [ ] Create `.DONE`

## Amendments

- 2026-09-05: Pre-landed contract redirect — operator-runbook.md already touched by SP-747; mustChange is matrix modules only.

## Discoveries

| # | Finding | Disposition |
|---|---------|-------------|
| 1 | LLM-row env injection has no existing seam: `runWorker`/`spawnWorkerHandle`/`spawnWorkerChild`/`buildWorkerChildEnv` accept no extra env. | Thread additive optional `extraEnv` through worker-host.mjs + worker-spawn.mjs (outside listed File Scope but logically required by the Mission "env vars present for LLM matrix row workers"). Defaults keep existing callers byte-identical. |
| 2 | Impact analysis: `buildWorkerChildEnv` HIGH blast radius (9 impacted). | Mitigated: additive optional param only; no behavior change when omitted. |
| 3 | Contract commands reject `$` (#268), so env-consuming rows must call helper scripts rather than inline `$VAR` in runCommand. | Test fixtures use committed `scripts/dump-matrix-env.sh`. |
