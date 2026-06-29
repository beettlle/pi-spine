# Task: SP-352 — Planner overlap detection module

**Created:** 2026-06-28
**Size:** S
**Split from:** SP-340

## Review Level: 2 (Plan + Code)

**Assessment:** Extract file-scope overlap detection helper for wave planner.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Part of **GitHub issue #31** (split from SP-340): add `src/planner/file-scope.mjs` with overlap detection across task File Scope globs.

**Required behavior:**

1. Detect overlapping File Scope paths across tasks in same wave.
2. Unit tests for overlap pairs and glob edge cases.

**Issue:** [#31](https://github.com/beettlle/pi-spine/issues/31) — delivery shared with split sibling

## Dependencies

- **None**

## File Scope

- `src/planner/file-scope.mjs`
- `tests/planner/file-scope-overlap.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/planner/file-scope-overlap.test.mjs` |
| fileScopeMustChange | `src/planner/file-scope.mjs` |
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
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Required behavior implemented
- [ ] Tests pass with coverage gate


## Do NOT

- Expand beyond split scope from SP-340

---
## Amendments (Added During Execution)
