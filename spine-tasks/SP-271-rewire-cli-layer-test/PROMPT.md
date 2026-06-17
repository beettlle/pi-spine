# Task: SP-271 — Rewire cli/migrate and layer inversion test

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Finish src→bin cleanup for cli/migrate plus static layer test.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Update `src/cli/**` and `src/migrate/**` to import from `src/config/*`. Add `tests/config/spine-config-layer.test.mjs` asserting zero `src/**` imports from `bin/**`.

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

- `src/cli/**/*.mjs`
- `src/migrate/**/*.mjs`
- `tests/config/spine-config-layer.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | tests/config/spine-config-layer.test.mjs |
| artifactsMustExist | tests/config/spine-config-layer.test.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-269 complete; SP-270 may land in parallel

### Step 1: Rewire + test
> **Code review checkpoint**

- [ ] Update cli/migrate imports
- [ ] Add layer inversion grep/AST test
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`
- [ ] `node bin/spine.mjs doctor` smoke

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

- `feat(SP-271): complete Step N — description`
- `fix(SP-271): description`
- `test(SP-271): description`

## Do NOT

- Leave any src/** importing bin/**
---

## Amendments (Added During Execution)
