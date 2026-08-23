# Task: SP-715 — Engine liveness pairs PID with engineStartedAt

**Created:** 2026-08-22
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Process liveness correctness; orphan recovery paths.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #259 — Add `isEngineProcessAlive(pid, expectedStartedAt)` comparing stored `engineStartedAt` with process start time. Replace engine ownership checks to use paired liveness. Fall back to PID-only on Windows with documented limitation.

## Dependencies

- **None**

## Context to Read First

- `src/process/liveness.mjs` — `isProcessAlive`
- `src/batch/state-guards.mjs` — `recordBatchEnginePid`
- `tests/batch/orphan-dead-engine.test.mjs`
- GitHub #259

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/process/liveness.mjs`
- `src/batch/state-guards.mjs`
- `src/batch/reconcile-orphan.mjs`
- `tests/batch/engine-liveness-starttime.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/engine-liveness-starttime.test.mjs tests/batch/orphan-dead-engine.test.mjs` |
| fileScopeMustChange | `tests/batch/engine-liveness-starttime.test.mjs` |

## Steps

### Step 1: Paired liveness helper

- [x] Add `isEngineProcessAlive(pid, expectedStartedAt)` with injectable liveness probe
- [x] macOS: compare ps start time; Linux: `/proc/<pid>/starttime` when available
- [x] Windows: PID-only fallback with code comment

### Step 2: Wire engine ownership checks

- [x] Update `state-guards`, `reconcile-orphan`, and related callers to use paired check

### Step 3: Testing & Verification

- [x] Add PID-reuse mismatch test
- [x] Run contract `testCommand` only

### Step 4: Documentation & Delivery

- [x] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — PID reuse / orphan recovery if operator-facing

## Completion Criteria

- [x] Mismatched start time returns not-alive
- [x] Existing orphan-dead-engine tests pass
- [x] Closes #259

## Do NOT

- Change worker child PID tree termination
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-715): pair engine PID with engineStartedAt for liveness (#259)`
