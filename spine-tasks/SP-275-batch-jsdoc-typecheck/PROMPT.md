# Task: SP-275 — JSDoc checkJs for batch hot paths

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Fix tsc errors in scoped batch modules with minimal JSDoc.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Resolve all tsc checkJs errors in engine.mjs, worker-host.mjs, worktree.mjs, spine-config-load.mjs. Add typecheck-batch regression test.

## Dependencies

- **Task:** SP-274

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

```bash
spine settings set agents.worker.model cursor/auto
spine settings set agents.reviewer.model google/gemini-3.1-pro-preview
```

## Context to Read First

- `tsconfig.batch.json`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine.mjs`
- `src/batch/worker-host.mjs`
- `src/batch/worktree.mjs`
- `src/config/spine-config-load.mjs`
- `tests/config/typecheck-batch.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && npm run coverage:check` |
| fileScopeMustChange | tests/config/typecheck-batch.test.mjs |
| artifactsMustExist | tests/config/typecheck-batch.test.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-274 complete

### Step 1: JSDoc fixes
> **Code review checkpoint**

- [ ] Minimal @param/@returns only where tsc requires
- [ ] No runtime behavior changes
- [ ] Call `spine_review_step` after step

### Step 2: Regression test

- [ ] Add tests/config/typecheck-batch.test.mjs

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Log discoveries in STATUS.md if needed
- [ ] Create `.DONE`
- [ ] One-line typecheck scope note in operator runbook

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `README.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-275): complete Step N — description`
- `fix(SP-275): description`
- `test(SP-275): description`

## Do NOT

- Type review.mjs god-file in this slice
---

## Amendments (Added During Execution)
