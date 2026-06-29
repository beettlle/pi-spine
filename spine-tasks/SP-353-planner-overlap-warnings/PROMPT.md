# Task: SP-353 — Planner overlap plan warnings

**Created:** 2026-06-28
**Size:** S
**Split from:** SP-340

## Review Level: 2 (Plan + Code)

**Assessment:** Integrate overlap detection into spine plan output and lane serialization.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Part of **GitHub issue #31** (split from SP-340): serialize conflicting tasks to same lane or emit explicit overlap report during `spine plan`.

**Required behavior:**

1. Plan output warns or serializes on file-scope overlap.
2. Regression: two tasks same file → single lane or plan warning.

**Closes:** [#31](https://github.com/beettlle/pi-spine/issues/31) (with sibling split tasks)

## Dependencies

- **Task:** SP-352

## File Scope

- `src/planner/index.mjs`
- `src/planner/waves.mjs`
- `tests/planner/file-scope-overlap.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/planner/file-scope-overlap.test.mjs` |
| fileScopeMustChange | `src/planner/waves.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/planner/file-scope-overlap.test.mjs` |

## Steps

### Step 0: Preflight
- [ ] Read issue #31 and superseded SP-340 PROMPT

### Step 1: Implementation
- [ ] Implement required behavior

### Step 2: Testing & Verification
- [ ] Contract test passes
- [ ] FULL suite + coverage gate

### Step 3: Delivery
- [ ] Close issue #31
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Required behavior implemented
- [ ] Tests pass with coverage gate
- [ ] Issue #31 closed

## Do NOT

- Expand beyond split scope from SP-340

---
## Amendments (Added During Execution)
