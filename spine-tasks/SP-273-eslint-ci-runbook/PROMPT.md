# Task: SP-273 — Wire lint into CI and runbook

**Created:** 2026-06-17
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CI and operator docs for npm run lint.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Add `npm run lint` to `.github/workflows/ci.yml` and document in operator runbook. Depends on SP-272 eslint config existing.

## Dependencies

- **Task:** SP-272

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

- `.github/workflows/ci.yml`
- `docs/adoption/operator-runbook.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `.github/workflows/ci.yml`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint` |
| fileScopeMustChange | .github/workflows/ci.yml |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-272 complete (`npm run lint` exists)

### Step 1: CI and docs

- [ ] Add lint step to ci.yml after typecheck
- [ ] Add npm run lint to operator runbook dev verification section

### Step 2: Testing & Verification

- [ ] `npm run lint` exits 0
- [ ] Full suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Log discoveries in STATUS.md if needed
- [ ] Create `.DONE`

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

- `feat(SP-273): complete Step N — description`
- `fix(SP-273): description`
- `test(SP-273): description`

## Do NOT

- Change eslint rules (SP-272)
---

## Amendments (Added During Execution)
