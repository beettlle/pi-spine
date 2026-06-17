# Task: SP-270 — Rewire batch imports off bin

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Update src/batch and dashboard snapshot imports to src/config.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Replace all `src/batch/**` and `src/dashboard/snapshot.mjs` imports from `../../bin/` with `src/config/*` equivalents.

## Dependencies

- **Task:** SP-269

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

- `spine-tasks/SP-260-fix-src-bin-imports/PROMPT.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/**/*.mjs`
- `src/dashboard/snapshot.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | src/batch/engine.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-269 complete

### Step 1: Rewire imports
> **Code review checkpoint**

- [ ] Update all src/batch and dashboard imports
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

- `feat(SP-270): complete Step N — description`
- `fix(SP-270): description`
- `test(SP-270): description`

## Do NOT

- Touch src/cli (SP-271)
- Change spine-config.json schema
---

## Amendments (Added During Execution)
