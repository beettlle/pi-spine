# Task: SP-343 — Attached batch exit after complete

**Created:** 2026-06-28
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Attached batch CLI hangs silently after `batch.completed` with zero stdout.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #34**: `spine batch start pending --attached` produces no console output and process stays alive after batch reaches `completed`/`needs_integrate`.

**Required behavior:**

1. Pipe engine land-loop milestones to attached stdout.
2. Exit attached CLI after `batch.completed` with integrate instructions (exit 0).
3. Regression test: attached runner exits after completed phase.

**Closes:** [#34](https://github.com/beettlle/pi-spine/issues/34)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #34
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `bin/spine-batch.mjs`
- `src/batch/attached-runner.mjs`
- `tests/batch/attached-batch-exit.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/attached-batch-exit.test.mjs` |
| fileScopeMustChange | `src/batch/attached-runner.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/attached-batch-exit.test.mjs` |

## Steps

### Step 0: Preflight: trace attached land loop

- [ ] Preflight: trace attached land loop

### Step 1: Stdout milestones + exit on complete

- [ ] Stdout milestones + exit on complete

### Step 2: Tests + delivery

- [ ] Tests + delivery

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #34 (`gh issue close 34`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #34 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-343): complete Step N — description`
- `fix(SP-343): description`
- `test(SP-343): description`

## Do NOT

- Expand scope beyond issue #34 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
