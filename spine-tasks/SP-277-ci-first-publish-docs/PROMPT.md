# Task: SP-277 — CI-first publish doc sync

**Created:** 2026-06-17
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only alignment with publish.yml CI workflow.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Update README, docs/release/*, and operator-runbook to describe CI-first release: bump version on main → green CI → publish.yml. Demote manual npm publish to emergency footnote. Sync README version with package.json.

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

- `.github/workflows/publish.yml`
- `docs/release/npm-publish.md`
- `docs/release/v1.0-checklist.md`
- `package.json`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `README.md`
- `docs/release/npm-publish.md`
- `docs/release/v1.0-checklist.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | docs/release/npm-publish.md |

## Steps

### Step 0: Preflight

- [ ] Read publish.yml trigger and skip-if-exists logic

### Step 1: Update release docs

- [ ] CI-first flow in npm-publish.md and v1.0-checklist.md
- [ ] README CI section mentions publish workflow + current version
- [ ] Remove "Until npm publish" from operator-runbook

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Log discoveries in STATUS.md if needed
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/release/npm-publish.md`
- `docs/release/v1.0-checklist.md`
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `README.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-277): complete Step N — description`
- `fix(SP-277): description`
- `test(SP-277): description`

## Do NOT

- Change publish.yml in this task
- Run npm publish locally
---

## Amendments (Added During Execution)
