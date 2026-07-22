# Task: SP-683 — Reconcile gate-pending needs_integrate

**Created:** 2026-07-22
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Single reconciliation branch + suggestedCommand for gate-pending land loop; well-scoped regression.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #221 — When all tasks are terminal-success, orch is ahead of base, and the integrate gate is pending (or mergeResults already populated while phase is still `running`), `spine status --diagnose` must report `needs_integrate` — not `running` — so `spine wait --until completed,failed,needs_integrate,needs_retry,aborted` wakes. When gate status is pending, `suggestedCommand` must be `spine gate approve`.

**Evidence shape (batch `20260720T211047`):** `allTasksTerminalSuccess`, `mergeResultsEmpty: false`, `phase: running`, gate pending, orch ahead.

**Sibling:** SP-684 updates skill/runbook wait recipes after this diagnose fix lands.

## Dependencies

- **None**

## Context to Read First

- `src/batch/reconcile-diagnosis.mjs` — `needs_integrate` / `RUNNING_PHASES` fallthrough (~L398–437)
- `src/batch/diagnosis.mjs` — `buildSuggestedCommand` `needs_integrate` branch
- `src/batch/reconcile-diagnosis-context.mjs` / `diagnosis-gate-ready.mjs` — `integrateGateOpen`
- `tests/batch/diagnosis.test.mjs`
- `tests/cli/spine-wait-diagnosis.test.mjs`
- GitHub #221

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/reconcile-diagnosis.mjs`
- `src/batch/diagnosis.mjs`
- `tests/batch/diagnosis.test.mjs`
- `tests/cli/spine-wait-diagnosis.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/diagnosis.test.mjs tests/cli/spine-wait-diagnosis.test.mjs` |
| fileScopeMustChange | `src/batch/reconcile-diagnosis.mjs`, `tests/batch/diagnosis.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce #221 signal shape: terminal-success + orch ahead + gate pending + `mergeResultsEmpty: false` + `phase: running` → diagnose `running`
- [ ] Trace `reconcileDiagnosis` fallthrough past merge/`needs_integrate` branches into `RUNNING_PHASES`

### Step 1: Diagnose needs_integrate for gate-pending land loop

- [ ] Before the `RUNNING_PHASES` fallthrough, when `allTasksTerminalSuccess` && orch exists && !orchMergedToBase && no running/pending tasks, return `needs_integrate` (cover non-empty mergeResults + pending gate)
- [ ] When gate is pending / `integrateGateOpen`, `buildSuggestedCommand("needs_integrate", …)` returns `spine gate approve`
- [ ] Do not weaken diagnoses for truly running workers or non-terminal batches

### Step 2: Testing & Verification

- [ ] Add regression covering wave-0 snapshot shape (`mergeResultsEmpty: false`, `phase: running`, gate pending → `needs_integrate`)
- [ ] Assert wait taxonomy match: `needs_integrate` satisfies `--until completed,failed,needs_integrate,needs_retry,aborted` without requiring land-loop pseudos
- [ ] Run contract `testCommand` only (scoped) — do **not** run full `npm test` or `npm run coverage:check` in the lane
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-684 owns skill/runbook wait recipe text)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — land-loop wait targets

## Completion Criteria

- [ ] Gate pending + terminal-success + orch ahead → diagnose `needs_integrate`, not `running`
- [ ] `suggestedCommand` is `spine gate approve` when gate pending
- [ ] Regression test covers the #221 snapshot shape

## Do NOT

- Rewrite all limbo/merge diagnosis branches
- Expand wait default lists in skills (SP-684)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-683): diagnose needs_integrate when gate pending (#221)`
