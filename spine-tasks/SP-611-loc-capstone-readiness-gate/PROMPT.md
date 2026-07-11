# Task: SP-611 — LOC capstone readiness gate

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Block empty-grandfather / LOC-capstone tasks from scheduling when batch-loc-policy would fail.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #192 — Capstone tasks that empty `PHASE23_GRANDFATHERED_OVER_500` (or equivalent LOC-policy exit) must not become runnable until `batch-loc-policy` would pass after the change. SP-593 hit `worker_done_missing` because leftovers still exceeded 500 LOC while the packet could only edit `verify.mjs`.

**Source:** [`docs/PRD-v2.3.1-reliability-handoff.md`](../../docs/PRD-v2.3.1-reliability-handoff.md) §6 FR-REL231-04

**Do not** re-open SP-593 or re-populate the grandfather list. Engine orch→lane sync is SP-610.

## Dependencies

- **None**

## Context to Read First

- [`bin/spine-cli/verify.mjs`](../../bin/spine-cli/verify.mjs) — `PHASE23_GRANDFATHERED_OVER_500`, `batch-loc-policy`
- [`src/config/preflight/discovery.mjs`](../../src/config/preflight/discovery.mjs)
- [`src/planner/index.mjs`](../../src/planner/index.mjs) — optional plan-time gate
- GitHub issue #192

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/preflight/`
- `src/planner/`
- `bin/spine-cli/verify.mjs`
- `tests/config/loc-capstone-readiness.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/config/loc-capstone-readiness.test.mjs` |
| fileScopeMustChange | `src/config/preflight/` |
| artifactsMustExist | `tests/config/loc-capstone-readiness.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Define detection for empty-grandfather / LOC-capstone missions (PROMPT markers, File Scope on `verify.mjs` grandfather constant, or explicit mission phrase)
- [ ] Confirm how to evaluate `batch-loc-policy` without mutating the list

### Step 1: Readiness gate

- [ ] Add planner and/or preflight check that blocks scheduling when the task would empty the grandfather list while any non-grandfathered `src/batch/*.mjs` still exceeds 500 LOC
- [ ] Emit actionable error (which modules still over limit) — fail closed

### Step 2: Testing & Verification

- [ ] Add `tests/config/loc-capstone-readiness.test.mjs` — blocked vs allowed cases
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — advisory if preflight message changes

## Completion Criteria

- [ ] Premature empty-grandfather / LOC-capstone tasks fail preflight/plan with clear module list
- [ ] Ready trees still allow the task
- [ ] Grandfather list remains empty on current main (no re-open)
- [ ] Issue #192 closable after land

## Do NOT

- Re-populate `PHASE23_GRANDFATHERED_OVER_500`
- Re-author or retry SP-593
- Implement orch→lane sync (SP-610)
- Skip tests
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-611): block LOC capstone until batch-loc-policy ready`
