# Task: SP-342 — Stub release task guard

**Created:** 2026-06-28
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Stub workers mark release-critical git/network tasks succeeded with only `.DONE` stub commits.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #33**: batch `20260628T051158` — stub completed SP-137–SP-145 (merge/push/version) without performing required work.

**Required behavior:**

1. Reject or fail stub completion when PROMPT contract requires git/network ops (`fileScopeMustChange` unchanged).
2. Surface `exitReason: stub` in diagnosis when `.DONE` contains `Task: stub` for M/L tasks.
3. Preflight warn when `SPINE_WORKER_STUB=1` and pending tasks have release-critical contracts.
4. Regression test: stub cannot succeed merge/version task without file-scope changes.

**Closes:** [#33](https://github.com/beettlle/pi-spine/issues/33)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #33
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/lane-commit.mjs`
- `src/batch/contract-verify.mjs`
- `src/batch/diagnosis.mjs`
- `src/config/spine-preflight-lib.mjs`
- `tests/batch/stub-release-task-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/stub-release-task-guard.test.mjs` |
| fileScopeMustChange | `src/batch/lane-commit.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/stub-release-task-guard.test.mjs` |

## Steps

### Step 0: Preflight: SP-137–SP-145 stub .DONE pattern

- [ ] Preflight: SP-137–SP-145 stub .DONE pattern

### Step 1: Contract fail-closed for stub

- [ ] Contract fail-closed for stub

### Step 2: Preflight warning

- [ ] Preflight warning

### Step 3: Tests + delivery

- [ ] Tests + delivery

### Step 4: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 5: Documentation & Delivery

- [ ] Close issue #33 (`gh issue close 33`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #33 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-342): complete Step N — description`
- `fix(SP-342): description`
- `test(SP-342): description`

## Do NOT

- Expand scope beyond issue #33 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
