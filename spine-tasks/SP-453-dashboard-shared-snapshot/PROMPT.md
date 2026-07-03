# Task: SP-453 — Dashboard shared reconcile snapshot

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Dashboard server tick fan-out; touches snapshot + server.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

One `reconcileBatch` + journal tail read per dashboard server poll tick; fan out snapshot to all SSE clients instead of per-client full reconcile/parse ([#98](https://github.com/beettlle/pi-spine/issues/98) P0).
**Closes:** [#98](https://github.com/beettlle/pi-spine/issues/98) (partial)

## Dependencies

- **Task:** SP-451 (journal cache available for tail reads)

## Context to Read First

- GitHub issue #98
- `src/dashboard/server.mjs`, `src/dashboard/snapshot.mjs`
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/server.mjs`
- `src/dashboard/snapshot.mjs`
- `tests/dashboard/shared-snapshot.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/shared-snapshot.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/dashboard/server.mjs` |
| artifactsMustExist | `tests/dashboard/shared-snapshot.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #98 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Shared tick

- [ ] Build snapshot once per poll interval
- [ ] Fan-out cached snapshot to SSE clients

### Step 2: Journal tail

- [ ] Use journal cache/tail (last N events) not full parse per client

### Step 3: Tests

- [ ] Multi-client SSE receives same snapshot generation
- [ ] Reconcile called once per tick in test harness

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #98 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — one dashboard per machine

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-453): complete Step N — description`
- `fix(SP-453): description`
- `hydrate: SP-453 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
