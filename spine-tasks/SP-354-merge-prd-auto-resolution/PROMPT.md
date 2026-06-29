# Task: SP-354 — Merge PRD auto-resolution

**Created:** 2026-06-28
**Size:** S
**Split from:** SP-346

## Review Level: 2 (Plan + Code)

**Assessment:** Extend merge auto-resolution for docs/PRD.md release-recovery conflicts.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Part of **GitHub issue #37** (split from SP-346): extend lane→orch merge auto-resolution for `docs/PRD.md` when both sides are additive; actionable `lastError` on failure.

**Required behavior:**

1. Auto-resolve additive PRD.md conflicts where safe.
2. Regression test for origin/main merge + PRD conflict.
3. Runbook merge recovery section updated.

**Issue:** [#37](https://github.com/beettlle/pi-spine/issues/37) — delivery shared with split sibling

## Dependencies

- **Task:** SP-310

## File Scope

- `src/batch/engine-lanes/merge.mjs`
- `src/batch/merge/adoption-doc-merge.mjs`
- `tests/batch/merge-prd-conflict.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/merge-prd-conflict.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/merge.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/merge-prd-conflict.test.mjs` |

## Steps

### Step 0: Preflight
- [ ] Read issue #37 and superseded SP-346 PROMPT

### Step 1: Implementation
- [ ] Implement required behavior

### Step 2: Testing & Verification
- [ ] Contract test passes
- [ ] FULL suite + coverage gate

### Step 3: Delivery
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Required behavior implemented
- [ ] Tests pass with coverage gate


## Do NOT

- Expand beyond split scope from SP-346

---
## Amendments (Added During Execution)
