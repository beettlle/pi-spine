# Task: SP-698 — Matrix parent aggregation, #224 hook docs, supersede SP-690

**Created:** 2026-08-03
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Completes #228 ACs around parent aggregation, fail-one-row behavior, runbook superseding SP-690 interim throttle; schedule core lands in SP-697.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Mission

Closes #228 — Finish first-class matrix row scheduling: parent `SP-X` succeeds only when **all** rows succeed (default); preserve #224 `worktreeSetupHook` on every row worktree; update operator runbook / QUICK-REFERENCE so the SP-690 nested-throttle interim is superseded; add regression that one failing row fails the parent. Depends on SP-697 schedule core.

**Hard requirement:** Default success policy = all rows succeed; document that #229–#232 (env, status APIs, maxFailedIndexes, full PROMPT subst) remain deferred.

## Dependencies

- **Task:** SP-697 (first-class row lane schedule core must exist)

## Context to Read First

- `src/batch/engine-lanes/matrix-run.mjs` — aggregation helpers after SP-697
- `src/batch/engine-lanes/matrix.mjs` — `aggregateMatrixOutcomes`, setup hook
- `tests/batch/matrix-execution.test.mjs`
- `docs/adoption/operator-runbook.md` §2.4
- `docs/QUICK-REFERENCE.md` — matrix note if present
- GitHub #228
- Parent split: SP-697 — schedule core
- Manifest: `spine-tasks/_authoring/release-v2.12.3/manifest.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/matrix-run.mjs`
- `src/batch/engine-lanes/matrix.mjs`
- `tests/batch/matrix-execution.test.mjs`
- `docs/adoption/operator-runbook.md`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/matrix-execution.test.mjs` |
| fileScopeMustChange | `docs/QUICK-REFERENCE.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-697 `.DONE` / schedule core integrated before implementing
- [ ] Confirm current parent success / failure aggregation semantics
- [ ] Confirm runbook still documents SP-690 interim throttle

### Step 1: Aggregation + docs superseding interim throttle

- [ ] Ensure parent succeeds only when all rows succeed (default)
- [ ] Regression: one bad row fails parent aggregation
- [ ] Confirm #224 hook still runs on every row worktree (fix if SP-697 left a gap)
- [ ] Rewrite runbook §2.4 / QUICK-REFERENCE: first-class row lanes supersede nested throttle; note deferred #229–#232

### Step 2: Testing & Verification

- [ ] Fail-one-row aggregation test green
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code

### Step 3: Documentation & Delivery

- [ ] Must-update docs complete
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — §2.4 first-class row lanes; retire SP-690 interim as current truth
- `docs/QUICK-REFERENCE.md` — matrix concurrency note if still describing nested throttle

**Check If Affected:**
- None

## Completion Criteria

- [ ] Parent aggregation fail-closed on any row failure (default)
- [ ] Fail-one-row regression exists
- [ ] #224 hook preserved/documented
- [ ] Runbook supersedes SP-690 interim language
- [ ] #228 closable (with SP-697)

## Do NOT

- Re-enable `buildPlan` matrix propagation (SP-696)
- Implement #229–#232 epic children
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-698): matrix parent aggregation and supersede nested throttle docs (#228)`

## Amendments

- **2026-08-06 (pre-landed shared scope):** SP-697 already landed first-class row scheduling plus fail-one-row / aggregation regressions in `tests/batch/matrix-execution.test.mjs`, and SP-695 touched `docs/adoption/operator-runbook.md`. Redirected `fileScopeMustChange` to `docs/QUICK-REFERENCE.md` so contract verification measures SP-698's remaining docs delivery. Still rewrite runbook §2.4 (File Scope / Must Update) to supersede the SP-690 interim throttle, confirm aggregation/#224 hook gaps if any, and keep matrix tests in File Scope for any follow-up edits.