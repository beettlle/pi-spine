# Task: SP-614 — Salvage lane commits

**Created:** 2026-07-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Fix salvage discovery so aborted batches still list/integrate succeeded lane task-branch commits.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #196 — After abort, `spine batch salvage --dry-run` must list lanes whose task branches have commits ahead of base when the task reached terminal-success / lane `.DONE`. `salvage --lane N --integrate` must not return `lane_not_salvageable` solely because journal `lane.committed` was missing while the task branch is ahead of `main` (regression vs #158).

**Source:** [`docs/PRD-v2.3.2-state-drift-recovery-handoff.md`](../../docs/PRD-v2.3.2-state-drift-recovery-handoff.md) §6 FR-REL232-02

**Related:** #158 (salvage after abort)

## Dependencies

- **None**

## Context to Read First

- [`src/batch/salvage-batch-list.mjs`](../../src/batch/salvage-batch-list.mjs) — `listSalvageableLanes`
- [`src/batch/salvage-batch.mjs`](../../src/batch/salvage-batch.mjs) — `integrateSalvageableLane`
- [`tests/batch/batch-salvage-list.test.mjs`](../../tests/batch/batch-salvage-list.test.mjs)
- [`tests/batch/batch-salvage-integrate.test.mjs`](../../tests/batch/batch-salvage-integrate.test.mjs)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/salvage-batch-list.mjs`
- `src/batch/salvage-batch.mjs`
- `tests/batch/batch-salvage-list.test.mjs`
- `tests/batch/batch-salvage-integrate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-salvage-list.test.mjs tests/batch/batch-salvage-integrate.test.mjs` |
| fileScopeMustChange | `src/batch/salvage-batch-list.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce empty salvage list with task branch ahead of base + lane `.DONE`
- [ ] Identify journal vs git-branch evidence gap in `listSalvageableLanes` / integrate

### Step 1: Detect and land lane branch commits

- [ ] List salvageable lanes when task branch has commits ahead of base for terminal-success / doneInLane tasks
- [ ] Integrate path lands those commits without false `lane_not_salvageable`
- [ ] Keep non-salvageable exit-reason exclusions intact

### Step 2: Testing & Verification

- [ ] Add/extend regression covering #196 salvage miss
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — salvage section if CLI messaging changes

## Completion Criteria

- [ ] Salvage dry-run lists succeeded lane commits after abort
- [ ] Integrate can land those commits
- [ ] Regression tests cover the #196 salvage miss

## Do NOT

- Pull pending SP-605 LOC extract into this task
- Change abort dry-run behavior (SP-615)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-614): salvage lists and integrates lane task-branch commits`
