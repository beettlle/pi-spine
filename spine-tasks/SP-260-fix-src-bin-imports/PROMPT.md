# Task: SP-260 — Fix src→bin layer inversion for spine-config

**Created:** 2026-06-17
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Move `loadSpineConfig` and related loaders from `bin/` into `src/config/` so library code does not import CLI entrypoints; touches many import sites.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Sixteen `src/` modules import from `bin/spine-config.mjs`, `bin/spine-preflight.mjs`, or `bin/spine-init.mjs`, inverting the layer boundary (src should not depend on bin). Move config loading into `src/config/` and make `bin/` thin re-exporters.

## Dependencies

- **None** (coordinate with SP-258/259 — disjoint file sets; avoid editing `review.mjs` unless required)

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

- `bin/spine-config.mjs` — `loadSpineConfig`, `validateSpineConfig`
- `bin/spine-preflight.mjs` — `resolveTasksRoot`, `runBatchPreflight`
- `bin/spine-init.mjs` — `DEFAULT_TASKS_ROOT`, template loader
- Grep `from "../../bin/` under `src/` for full import inventory

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
- `src/batch/**/*.mjs`
- `src/cli/**/*.mjs`
- `src/dashboard/**/*.mjs`
- `src/migrate/**/*.mjs`
- `tests/config/spine-config-layer.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/config/spine-config-load.mjs` |
| fileScopeMustNotChange | `src/batch/review.mjs`, `src/batch/engine-lanes/review.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `src/config/spine-config-load.mjs` |

## Steps

### Step 0: Preflight

- [ ] List all `src/**` imports from `bin/` (expect ~16 files)
- [ ] Confirm no circular dependency if config moves to `src/config/`

### Step 1: Move config loaders to src
> **Plan-review checkpoint**

- [ ] Create `src/config/spine-config-load.mjs` — move `loadSpineConfig` / validation from bin
- [ ] Create `src/config/spine-preflight-lib.mjs` — move `resolveTasksRoot`, `runBatchPreflight` helpers used by src
- [ ] Create `src/config/spine-init-constants.mjs` — move `DEFAULT_TASKS_ROOT` and template loader used by src
- [ ] `bin/*.mjs` re-export from src modules (CLI surface unchanged)
- [ ] Call `spine_review_step` after step

### Step 2: Rewire src imports
> **Code review checkpoint**

- [ ] Update every `src/**` file to import from `src/config/*` instead of `bin/*`
- [ ] Add `tests/config/spine-config-layer.test.mjs` — assert no `src/` file imports `../../bin/` (static grep test or AST)
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Run `spine doctor` smoke (if pi available) or `node bin/spine.mjs doctor`
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Note any remaining bin imports from src in STATUS.md (should be zero)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — only if CLI paths change (they should not)

## Completion Criteria

- [ ] Zero `src/**` imports from `bin/**`
- [ ] `bin/spine-config.mjs` and peers remain working CLI entrypoints via re-export
- [ ] Layer inversion test passes
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-260): complete Step N — description`
- `refactor(SP-260): description`
- `test(SP-260): description`

## Do NOT

- Refactor review.mjs (SP-258/259)
- Change spine-config.json schema
- Move CLI routing logic out of bin/spine.mjs

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-17
**Issue:** Original M packet too large for reliable pi workers.
**Resolution:** Superseded — execution moved to SP-269, SP-270, SP-271.

