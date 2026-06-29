# Task: SP-346 — Merge PRD conflict resolution

**Created:** 2026-06-28
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Wave merge fails on `docs/PRD.md` alongside rules-manifest when merge-origin-main task runs in batch.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #37**: batch `20260628T062636` — SP-137 succeeded but wave merge failed on `docs/PRD.md` + `.spine/rules-manifest.json` (auto-resolution only supports manifest).

**Required behavior:**

1. Extend merge auto-resolution for release-recovery paths touching `docs/PRD.md` when both sides are additive, OR preflight warn on predictable multi-file orch conflicts.
2. Actionable `lastError` with repair commands for PRD merge conflicts.
3. Regression test: origin/main merge task + PRD conflict auto-resolves or fails with clear diagnosis.

**Closes:** [#37](https://github.com/beettlle/pi-spine/issues/37)

## Dependencies

- **Task:** SP-310

## Context to Read First

- GitHub issue #37
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/engine-lanes/merge.mjs`
- `src/batch/merge/adoption-doc-merge.mjs`
- `src/config/spine-preflight-lib.mjs`
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

### Step 0: Preflight: batch 20260628T062636 journal

- [ ] Preflight: batch 20260628T062636 journal

### Step 1: PRD merge resolution or preflight guard

- [ ] PRD merge resolution or preflight guard

### Step 2: Tests + runbook + delivery

- [ ] Tests + runbook + delivery

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #37 (`gh issue close 37`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #37 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-346): complete Step N — description`
- `fix(SP-346): description`
- `test(SP-346): description`

## Do NOT

- Expand scope beyond issue #37 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
