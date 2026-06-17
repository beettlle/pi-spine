# Task: SP-272 — ESLint flat config and npm script

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Add eslint 9 flat config that passes on current tree.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Add `eslint.config.js`, `eslint` devDependency, and `npm run lint` scoped to src/bin/tests/scripts. Baseline rules only — no mass reformat.

## Dependencies

- **None**

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

- `package.json`
- `spine-tasks/SP-261-add-eslint-baseline/PROMPT.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `package.json`
- `package-lock.json`
- `eslint.config.js`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | eslint.config.js, package.json |
| artifactsMustExist | eslint.config.js |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm no existing eslint config

### Step 1: ESLint setup
> **Plan-review checkpoint**

- [ ] Add eslint devDep (verify on npm registry)
- [ ] eslint.config.js + npm run lint exits 0
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`
- [ ] List enabled rules in STATUS.md

### Step 4: Documentation & Delivery

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

- `feat(SP-272): complete Step N — description`
- `fix(SP-272): description`
- `test(SP-272): description`

## Do NOT

- Enable aggressive style rules requiring whole-repo reformat
- Wire CI yet (SP-273)
---

## Amendments (Added During Execution)
