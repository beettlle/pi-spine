# Task: SP-210 — Engine lanes review-phase wiring

**Created:** 2026-06-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Review phase wiring extract; touches review integration.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-210-ship-engine-lanes-review/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Extract review-phase wiring from `engine-lanes.mjs` into dedicated module. Coordinate with `src/batch/review.mjs` imports.

## Dependencies

- **Task:** SP-209

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `spine-tasks/_explore/engine-lanes-split/findings.md`
- `src/batch/review.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes.mjs`
- `src/batch/engine-lanes/**`
- `src/batch/review.mjs`
- `tests/batch/*review*.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/engine-lanes/**` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-209 landed
- [ ] Trace review-phase call sites in engine-lanes

### Step 1: Extract review wiring
> **Plan-review checkpoint**


- [ ] Move review-phase wiring to new module
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Review wiring extracted
- [ ] Review-related batch tests green
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-210): complete Step N — description`
- `fix(SP-210): description`
- `test(SP-210): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
