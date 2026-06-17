# Task: SP-262 — Extend typecheck to src batch hot paths

**Created:** 2026-06-17
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** `tsc` currently covers extensions only; add JSDoc `@ts-check` or expanded checkJs for critical `src/batch` modules.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Improve static safety on pure-JS batch modules without a full TypeScript migration. Extend `npm run typecheck` to validate `src/batch/` hot paths via `checkJs` and JSDoc types, starting with modules touched by recent refactors (config load, review spawn when SP-259 lands — coordinate timing).

## Dependencies

- **Task:** SP-260 (config modules in `src/config/` should exist before typing imports stabilize)

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

- `tsconfig.json` — current `include` / `checkJs` settings
- `package.json` — `typecheck` script
- `src/batch/engine.mjs` — representative hot path module

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tsconfig.json`
- `tsconfig.batch.json` (new partial config if needed)
- `package.json`
- `src/batch/engine.mjs`
- `src/batch/worker-host.mjs`
- `src/batch/worktree.mjs`
- `src/config/spine-config-load.mjs`
- `tests/config/typecheck-batch.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && npm run coverage:check` |
| fileScopeMustChange | `tsconfig.json`, `package.json` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/config/typecheck-batch.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-260 landed (`src/config/spine-config-load.mjs` exists)
- [ ] Run `npm run typecheck` — baseline passes
- [ ] Pick 4–6 batch modules for first `checkJs` slice (listed in File Scope)

### Step 1: Typecheck expansion design
> **Plan-review checkpoint**

- [ ] Add `tsconfig.batch.json` or extend root tsconfig with `checkJs: true` for `src/batch/**` and `src/config/**`
- [ ] Update `npm run typecheck` to run extension tsc + batch check (composite script or `tsc -p tsconfig.batch.json`)
- [ ] Add minimal JSDoc `@param` / `@returns` only where tsc requires — no drive-by annotations
- [ ] Call `spine_review_step` after step

### Step 2: Fix type errors in scope
> **Code review checkpoint**

- [ ] Resolve all tsc errors in scoped modules without changing runtime behavior
- [ ] Add `tests/config/typecheck-batch.test.mjs` — spawns `npm run typecheck` and asserts exit 0
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] `npm run typecheck` passes (extensions + batch)
- [ ] Run FULL test suite: `SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 4: Documentation & Delivery

- [ ] Document which dirs are checkJs-covered in operator runbook (one line)
- [ ] List modules deferred to future slice in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — typecheck scope note

**Check If Affected:**
- `README.md` — developer verification commands

## Completion Criteria

- [ ] `npm run typecheck` validates batch hot paths without errors
- [ ] No runtime behavior changes
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-262): complete Step N — description`
- `chore(SP-262): description`

## Do NOT

- Migrate entire repo to TypeScript
- Type `review.mjs` god-file in this slice (defer to follow-up)
- Weaken existing extension strict checks

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-17
**Issue:** Original M packet too large for reliable pi workers.
**Resolution:** Superseded — execution moved to SP-274, SP-275.

