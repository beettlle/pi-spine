# Task: SP-871 — After successful approved integrate, do not print Gate approval required

**Created:** 2026-11-18
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Cosmetic operator confusion after a successful land — banner contradicts the merge success lines.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** `formatIntegrateOutput` prints `Gate: approval required before integrate` whenever `result.gateRequired` is true, including after a successful approved merge. `gateRequired` means "gates are configured", not "still needs approval".

## Mission

Closes #359 — Integrate CLI messaging matches outcome:

1. **Success path** — After a successful integrate (approved gate, merge done), do **not** print `Gate: approval required before integrate`. Prefer `Gate: approved` when the gate was required and satisfied, or omit the Gate line.
2. **Blocked path** — Keep `Gate: integrate blocked until approved` / approval-required messaging when integrate actually stops for a pending gate.
3. **Dry-run** — Dry-run may still mention that approval will be required when pending; do not claim approval is still needed after a completed successful integrate.
4. **Tests** — Cover success-with-gate-required vs blocked-pending output strings.

## Dependencies

- **Task:** SP-869 (same `bin/spine-integrate.mjs` — serialize after --batch validation)

## Context to Read First

- GitHub #359
- `bin/spine-integrate.mjs` (`formatIntegrateOutput`)
- `src/batch/integrate.mjs` (`gateRequired` on success result)
- Related tests under `tests/batch/` / `tests/cli/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `bin/spine-integrate.mjs`
- `src/batch/integrate.mjs`
- `tests/batch/integrate-gate-output.test.mjs`
- `tests/batch/integrate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/integrate-gate-output.test.mjs tests/batch/integrate.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh lenient SP-871` |
| fileScopeMustChange | `bin/spine-integrate.mjs`, `tests/batch/integrate-gate-output.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Trace where `gateRequired` is set on success vs GateBlocked
- [ ] `rg -n "approval required before integrate" bin/ src/ tests/`

### Step 1: Fix success Gate line

- [ ] Success output: approved or omit; keep blocked messaging
- [ ] Adjust result fields if needed so formatter can distinguish

### Step 2: Tests

- [ ] Success vs blocked output assertions

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged (runbook owned by SP-866)
- [ ] Create `spine-tasks/SP-871-integrate-gate-line-after-success/.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-866 owns runbook)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — leave to SP-866

## Completion Criteria

- [ ] Successful integrate output has no "approval required" Gate line
- [ ] Blocked integrate still shows gate messaging
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-871): integrate omits approval-required Gate line after success (#359)`

## Do NOT

- Bypass gate checks
- Change integrate merge semantics
- Edit runbook (SP-866)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None