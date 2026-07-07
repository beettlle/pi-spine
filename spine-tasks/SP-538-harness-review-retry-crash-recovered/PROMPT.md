# Task: SP-538 — Harness review retry crash recovered

**Created:** 2026-07-07
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Review reconcile path fix — retry after contract_failed must not silently honor crash_recovered journal without operator visibility.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix [#188](https://github.com/beettlle/pi-spine/issues/188): on retry-reconcile, either skip redundant code review when artifact is fresh **or** re-spawn review with explicit `review.resumed` journal event. Surface `review.crash_recovered` distinctly in diagnose/dashboard — not buried in journal hints.

**Closes:** [#188](https://github.com/beettlle/pi-spine/issues/188)

## Dependencies

- **None**

## Context to Read First

- [`docs/PRD-v1.10.0-release-harness-handoff.md`](../../docs/PRD-v1.10.0-release-harness-handoff.md) (operator-added scope)
- [`src/batch/engine-lanes/review.mjs`](../../src/batch/engine-lanes/review.mjs) `review.crash_recovered`
- [`src/batch/diagnosis.mjs`](../../src/batch/diagnosis.mjs)
- Issue #188 journal evidence (batch `20260707T164359`, SP-516)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/review.mjs`
- `src/batch/diagnosis.mjs`
- `src/dashboard/snapshot.mjs`
- `tests/batch/review-retry-reconcile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/review-retry-reconcile.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/review.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #188 and journal excerpt for SP-516 retry path
- [ ] Trace `findCompletedCodeReview` honor path vs fresh spawn

### Step 1: Retry-reconcile review policy

- [ ] On retry-reconcile: emit `review.resumed` when re-spawning; or skip with explicit `review.skipped_fresh_artifact` when artifact is valid
- [ ] Do not emit `review.crash_recovered` without prior spawn failure when honorSource is reconcile-only

### Step 2: Operator visibility

- [ ] Diagnose/dashboard: surface `review.crash_recovered` in headline or signals when present for active task
- [ ] Distinguish fresh PASS vs recovered PASS in status output

### Step 3: Regression fixture

- [ ] `tests/batch/review-retry-reconcile.test.mjs`: retry → reconcile → review path

### Step 4: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 5: Documentation & Delivery

- [ ] Comment on #188
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Retry-reconcile review path has explicit journal events (no silent crash_recovered)
- [ ] Diagnose surfaces crash_recovered distinctly from normal PASS

## Do NOT

- Change contract verify behavior
- Remove honor of valid on-disk review artifacts when appropriate

## Git Commit Convention

- `fix(SP-538): review retry-reconcile crash_recovered visibility`
