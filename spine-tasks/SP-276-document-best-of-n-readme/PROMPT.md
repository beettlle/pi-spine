# Task: SP-276 — Best-of-N README documentation

**Created:** 2026-06-17
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only; dev script not shipped in npm package.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Document `scripts/best-of-n.mjs` in README: parallel pi runs across models in isolated worktrees, dev/git-checkout only (not in npm files whitelist), examples from script HELP, contrast with spine batch engine.

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

- `scripts/best-of-n.mjs`
- `README.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `README.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | README.md |

## Steps

### Step 0: Preflight

- [ ] Read scripts/best-of-n.mjs HELP and pick README section placement

### Step 1: Add Best-of-N section

- [ ] What/when/prerequisites/examples/cleanup
- [ ] Note: git checkout only, not npm install -g
- [ ] Optional: one line in Feature summary

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Log discoveries in STATUS.md if needed
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `README.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-276): complete Step N — description`
- `fix(SP-276): description`
- `test(SP-276): description`

## Do NOT

- Add best-of-n.mjs to package.json files whitelist
- Create separate markdown docs file
---

## Amendments (Added During Execution)
