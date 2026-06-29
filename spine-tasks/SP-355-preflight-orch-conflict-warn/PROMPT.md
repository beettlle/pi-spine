# Task: SP-355 — Preflight orch conflict warn

**Created:** 2026-06-28
**Size:** S
**Split from:** SP-346

## Review Level: 1 (Plan Only)

**Assessment:** Warn at plan/preflight when predictable multi-file orch merge conflicts are likely.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Part of **GitHub issue #37** (split from SP-346): preflight warns when pending tasks predict multi-file orch merge conflicts (e.g. merge-origin-main + PRD).

**Required behavior:**

1. Preflight or plan surfaces predictable PRD+manifest merge risk.
2. Regression test for preflight warning fixture.

**Closes:** [#37](https://github.com/beettlle/pi-spine/issues/37) (with sibling split tasks)

## Dependencies

- **Task:** SP-310

## File Scope

- `src/config/spine-preflight-lib.mjs`
- `tests/config/spine-preflight-orch-conflict.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/config/spine-preflight-orch-conflict.test.mjs` |
| fileScopeMustChange | `src/config/spine-preflight-lib.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/config/spine-preflight-orch-conflict.test.mjs` |

## Steps

### Step 0: Preflight
- [ ] Read issue #37 and superseded SP-346 PROMPT

### Step 1: Implementation
- [ ] Implement required behavior

### Step 2: Testing & Verification
- [ ] Contract test passes
- [ ] FULL suite + coverage gate

### Step 3: Delivery
- [ ] Close issue #37
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Required behavior implemented
- [ ] Tests pass with coverage gate
- [ ] Issue #37 closed

## Do NOT

- Expand beyond split scope from SP-346

---
## Amendments (Added During Execution)
