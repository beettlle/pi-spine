# Task: SP-274 — Add tsconfig.batch and typecheck script

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Expand typecheck infrastructure without fixing all module errors yet.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Add `tsconfig.batch.json` and update `npm run typecheck` to run extension tsc + batch checkJs pass.

## Dependencies

- **Task:** SP-271

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

- `tsconfig.json`
- `package.json`
- `spine-tasks/SP-262-extend-src-typecheck/PROMPT.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tsconfig.json`
- `tsconfig.batch.json`
- `package.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck` |
| fileScopeMustChange | package.json |
| artifactsMustExist | tsconfig.batch.json |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-271 landed (src/config stable)
- [ ] Baseline typecheck passes

### Step 1: Typecheck expansion
> **Plan-review checkpoint**

- [ ] Add tsconfig.batch.json with checkJs scope for src/batch + src/config
- [ ] Update npm run typecheck script
- [ ] Call `spine_review_step` after step

### Step 2: Testing & Verification

- [ ] npm run typecheck passes (may defer module JSDoc to SP-275)
- [ ] SPINE_WORKER_STUB=1 npm test

### Step 3: Documentation & Delivery

- [ ] Log discoveries in STATUS.md if needed
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-274): complete Step N — description`
- `fix(SP-274): description`
- `test(SP-274): description`

## Do NOT

- Add JSDoc to all batch modules (SP-275)
- Migrate entire repo to TypeScript
---

## Amendments (Added During Execution)
