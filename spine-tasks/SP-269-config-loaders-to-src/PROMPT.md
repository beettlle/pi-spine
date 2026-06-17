# Task: SP-269 — Move config loaders to src/config

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Create src/config modules and thin bin re-exports only.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 0

## Mission

Move `loadSpineConfig`, preflight helpers, and init constants from `bin/` into `src/config/*`. Make `bin/spine-config.mjs`, `bin/spine-preflight.mjs`, `bin/spine-init.mjs` thin re-exporters. Do not rewire src imports yet.

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

- `bin/spine-config.mjs`
- `bin/spine-preflight.mjs`
- `bin/spine-init.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/spine-config-load.mjs`
- `src/config/spine-preflight-lib.mjs`
- `src/config/spine-init-constants.mjs`
- `bin/spine-config.mjs`
- `bin/spine-preflight.mjs`
- `bin/spine-init.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | src/config/spine-config-load.mjs |
| artifactsMustExist | src/config/spine-config-load.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Grep src imports from bin — inventory for SP-270/271
- [ ] Confirm no circular deps

### Step 1: Move loaders
> **Plan-review checkpoint**

- [ ] Create three src/config modules
- [ ] bin/*.mjs re-export from src
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

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

- `feat(SP-269): complete Step N — description`
- `fix(SP-269): description`
- `test(SP-269): description`

## Do NOT

- Rewire src/** imports (SP-270/271)
- Touch review.mjs
---

## Amendments (Added During Execution)
