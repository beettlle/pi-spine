# Task: SP-868 — Gate approval-streak: lock streak read-modify-write (#314 remainder)

**Created:** 2026-11-18
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Concurrent gate approve/reject without a streak lock can race the consecutive-approval counter and unlock auto-approve incorrectly.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 0
**Problem theory:** SP-824 (Partial #314) made reset fail-closed and journaled streak I/O failures. The issue still tracks unlocked streak RMW. Lock-protect increment/reset (and reads used for auto-approve) so concurrent batches cannot leave a stale high streak.

## Mission

Closes #314 — Finish the remainder left open by SP-824:

1. **Lock streak RMW** — Serialize streak file read-modify-write (increment, reset, and auto-approve streak reads that decide allow-auto) with the same project-local lock pattern used elsewhere for batch-state / similar JSON stores. Prefer a small helper next to existing streak I/O.
2. **Preserve SP-824 behavior** — Failed reset still fail-closed + journaled; `streak_unreliable` still blocks auto-approve; increment failures still journal without reversing approval.
3. **Tests** — Cover lock acquisition around reset/increment (injected concurrent writers or lock-held stub); keep `tests/batch/gate-posture-streak-failure.test.mjs` green.

## Dependencies

- **None**

## Context to Read First

- GitHub #314
- `spine-tasks/SP-824-gate-streak-reset-fail-closed/PROMPT.md` (Partial #314)
- `src/batch/gate-posture-approve.mjs`, streak I/O modules
- `tests/batch/gate-posture-streak-failure.test.mjs`, `tests/batch/gate-posture-streak.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/gate-posture-approve.mjs`
- `src/batch/gate-posture-streak.mjs`
- `tests/batch/gate-posture-streak-failure.test.mjs`
- `tests/batch/gate-posture-streak.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/gate-posture-streak-failure.test.mjs tests/batch/gate-posture-streak.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-868` |
| fileScopeMustChange | `src/batch/gate-posture-approve.mjs`, `src/batch/gate-posture-streak.mjs`, `tests/batch/gate-posture-streak-failure.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-824 fail-closed behavior still present; locate streak I/O module(s)
- [ ] GitNexus impact on streak helpers; report in STATUS

### Step 1: Lock streak RMW

- [ ] Add lock around streak increment/reset/read used for auto-approve
- [ ] Keep SP-824 journal + streak_unreliable behavior

### Step 2: Tests

- [ ] Lock / concurrency coverage; keep existing streak-failure tests green

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged (runbook owned by SP-866)
- [ ] Create `spine-tasks/SP-868-gate-streak-lock/.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-866 owns runbook)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — leave to SP-866

## Completion Criteria

- [ ] Streak RMW is lock-protected
- [ ] SP-824 fail-closed tests still pass
- [ ] Contract `testCommand` exits 0
- [ ] Closes #314

## Git Commit Convention

- `fix(SP-868): lock gate approval-streak RMW (#314)`

## Do NOT

- Re-open SP-824 fail-closed design
- Weaken auto-approve safety
- Edit runbook (SP-866)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
