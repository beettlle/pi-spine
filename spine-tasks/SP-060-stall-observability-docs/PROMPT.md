# Task: SP-060 — Stall observability docs, fixture, dashboard (epic closeout)

**Created:** 2026-06-03
**Size:** M

## Review Level: 1 (Plan)

**Assessment:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Close Phase 11 stall epic: **SAT-020-style integration fixture**, operator runbook, PRD/gap updates, optional dashboard lane badge for checkpoint warning / stall killed. Assert event order: `checkpoint_warning` → `stall_killed` → `salvage_inspection` → `task.failed` (non-empty output).

## Dependencies

- **SP-056**
- **SP-057**
- **SP-058**

## Context to Read First

**Tier 3:** `docs/features/stall-recovery-improvements-brief.md` (Epic test plan, TP-STALL-04), `docs/adoption/operator-runbook.md`, `tests/batch/heartbeat.test.mjs`

## File Scope

- `tests/fixtures/stall-sat020/` (new)
- `tests/batch/stall-sat020-integration.test.mjs` (new)
- `docs/adoption/operator-runbook.md`
- `docs/PRD.md` (§18.4–18.5 alignment)
- `docs/compatibility/taskplane-gap-list.md`
- `src/dashboard/` (optional badge)
- `taskplane-tasks/CONTEXT.md`

## Steps

### Step 1: SAT-020 fixture + integration test

> **Plan-review checkpoint**

- [ ] `tests/fixtures/stall-sat020/`: stub emits 2× `task.step_completed`, touches file scope, then silence until stall
- [ ] Integration test asserts journal event order and non-empty `task.failed.output`
- [ ] Diagnose references worker log + salvage count

### Step 2: Operator docs

- [ ] Runbook: stall diagnosis flow (5-minute path), config keys table, retry with/without `autoCommitOnStall`
- [ ] Link SearchATon brief in `docs/features/`

### Step 3: Dashboard (if feasible)

- [ ] Lane badge for recent `lane.checkpoint_warning` or stall state (defer with comment if out of scope)

### Step 4: CONTEXT + gap list

- [ ] Mark SP-056–060 Done in CONTEXT Phase 11; note FR-STALL-* shipped
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Completion Criteria

- [ ] Epic test plan items 1–5 from brief (regression: .DONE required, mixed-outcome unchanged)

## Must Update

- `docs/adoption/operator-runbook.md`
- `taskplane-tasks/CONTEXT.md`

## Do NOT

- Re-implement SP-056–058 logic; only docs/tests/dashboard polish

## Git Commit Convention

`docs(SP-060): stall recovery operator guide and SAT-020 fixture`

## Amendments

_(Workers only.)_
