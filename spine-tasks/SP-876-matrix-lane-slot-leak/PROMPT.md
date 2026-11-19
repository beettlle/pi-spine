# Task: SP-876 — Matrix: release lane slot if state save throws; do not swallow packet load errors

**Created:** 2026-11-19
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** saveEngineBatchState before try/finally leaks lane slots on throw; loadMatrixTaskRows null-on-error runs matrix parents as plain workers.
**Score:** 5/8 — Blast radius: 3, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** runMatrixTaskOnLane acquires a slot then saves state before the try that releases the slot. Packet load errors become null and callers fall back to plain worker mode.

## Mission

Closes #311 — Matrix lane execution must release slots on save failure and must not silently demote broken matrix packets.

1. **Slot leak** — Move `saveEngineBatchState` (or wrap acquire+save) so `releaseLaneSlot` always runs if a slot was acquired.
2. **Packet errors** — Propagate `loadMatrixTaskRows` failures instead of null → plain-worker fallback (fail closed with a clear error).
3. **Tests** — Simulate save throw → slot released; broken packet → error (not plain worker).
4. **Keep** successful matrix row scheduling unchanged.

## Dependencies

- **None**

## Context to Read First

- GitHub #311
- `src/batch/engine-lanes/matrix-run.mjs` (acquireLaneSlot / save / finally)
- `loadMatrixTaskRows` call sites

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/engine-lanes/matrix-run.mjs`
- `tests/batch/matrix-run.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/matrix-run.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-876` |
| fileScopeMustChange | `src/batch/engine-lanes/matrix-run.mjs`, `tests/batch/matrix-run.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm acquire/save/finally order
- [ ] Trace loadMatrixTaskRows null path

### Step 1: Slot + packet fail-closed

- [ ] Always release acquired slots
- [ ] Propagate packet load errors

### Step 2: Tests

- [ ] Save throw releases slot
- [ ] Broken packet fails closed

### Step 3: Testing & Verification

- [ ] Run Contract testCommand
- [ ] Fix failures

### Step 4: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create .DONE

- [ ] Create `spine-tasks/SP-876-matrix-lane-slot-leak/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (metrics / plan-review sections when relevant)

## Completion Criteria

- [ ] Confirm acquire/save/finally order
- [ ] Trace loadMatrixTaskRows null path
- [ ] Always release acquired slots
- [ ] Propagate packet load errors
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-876): matrix lane slot leak and packet errors (#311)`

## Do NOT

- Change non-matrix lane scheduling
- Swallow packet errors into plain worker mode
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
