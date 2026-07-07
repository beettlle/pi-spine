# Task: SP-512 — Drift retry deadlock fix

**Created:** 2026-07-07
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Reconcile/diagnosis correctness; extends SP-496 for #170 regression.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix [#170](https://github.com/beettlle/pi-spine/issues/170): when lane has `.DONE` + review APPROVE but batch-state shows `status: running`, reconcile to terminal success **or** emit `suggestedCommand` that succeeds (not `retry` rejected for running task).

**Closes:** [#170](https://github.com/beettlle/pi-spine/issues/170)

**Source:** [`docs/PRD-v1.8.1-reconciliation-handoff.md`](../../docs/PRD-v1.8.1-reconciliation-handoff.md) FR-STA-01, FR-STA-03

## Dependencies

- SP-511

## Context to Read First

- GitHub [#170](https://github.com/beettlle/pi-spine/issues/170)
- `spine-tasks/_explore/reconciliation-v181/findings.md` (after SP-511)
- `src/batch/reconcile.mjs`, `src/batch/diagnosis.mjs`, `src/batch/journal-rebuild.mjs`
- `spine-tasks/SP-496-state-drift-recovery-ux/PROMPT.md`

## Environment

- **Workspace:** pi-spine repo root

## File Scope

- `src/batch/reconcile.mjs`
- `src/batch/diagnosis.mjs`
- `src/batch/journal-rebuild.mjs`
- `tests/batch/spine-diagnosis-state-drift.test.mjs`
- `tests/batch/reconcile-done-inlane-terminal.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/spine-diagnosis-state-drift.test.mjs tests/batch/reconcile-done-inlane-terminal.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/reconcile.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read #170 and SP-511 findings
- [ ] Reproduce drift scenario in test fixture

### Step 1: Reconcile fix

- [ ] When lane artifacts show terminal success, promote batch-state task to terminal (idempotent)
- [ ] Update `buildSuggestedCommand` for remaining drift: command must be runnable

### Step 2: Tests

- [ ] Add `reconcile-done-inlane-terminal.test.mjs` for #170 scenario
- [ ] Extend state_drift diagnosis tests

### Step 3: Testing & Verification

- [ ] Run contract testCommand
- [ ] Full suite if batch-touching: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Close #170 on GitHub
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Batch `20260705T210857` scenario reconciles without manual JSON edit
- [ ] `spine batch retry` not suggested for running task when retry would fail

## Do NOT

- Duplicate SP-445 scope (detection only) — this task lands terminal reconcile + actionable commands
