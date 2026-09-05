# SP-751: Matrix index env vars and matrixMaxParallel — Status

**Current Step:** 3
**Status:** 🔄 Step 3 in progress (docs + delivery)
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
**Status:** ✅ Complete

- [x] Inject five env vars for execute and LLM rows
- [x] Parse and enforce `matrixMaxParallel`
- [x] Tests for env injection and throttle capping

**Implemented:**
- `matrix.mjs`: `buildMatrixRowEnv()` (5 vars incl. `JOB_COMPLETION_INDEX` alias); `runShellInDir(cwd, command, extraEnv)`.
- `matrix-run.mjs`: `resolveMatrixRowConcurrency()` = min(throttle, global); `runMatrixSubLane` takes `rowIndex`/`rowCount` and injects env on both paths; `runMatrixTaskOnLane` reads parent contract, journals `matrixMaxParallel` + `rowConcurrency` on `matrix.task_started`.
- `parse-prompt.mjs`: `matrixMaxParallel` contract field, positive-int validation. `validate-contract.mjs`: emptiness check updated.
- `worker-spawn.mjs`/`worker-host.mjs`: additive optional `extraEnv` on `buildWorkerChildEnv`/`spawnWorkerChild`/`spawnWorkerHandle`/`runWorker`.
- Tests: 9 new (env shape, shell injection + back-compat, throttle math, child-env merge, execute E2E env dump, throttle serialization E2E, LLM row worker env via launch script, parse valid/invalid/backtick/passthrough).

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint`
- [x] Run Contract `testCommand`
- [x] Fix all failures

**Evidence:** Contract `testCommand` exit 0 — lint clean, typecheck clean (both tsconfigs), 55/55 tests pass (40 matrix-execution + 15 contract-matrix-subst). `detect_changes()` run: changes confined to intended symbols/flows.

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
