# Task: SP-366 — spine lane logs CLI

**Created:** 2026-06-29
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CLI resolver for lane log paths; depends on SP-365 live log paths.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #50**: add `spine lane logs` to tail lane worker logs without path guessing.

**Required behavior:**

1. `spine lane logs --lane 1 [--follow] [--task ID] [--batch ID]`
2. Prefer live log if present, else `worker-output-<taskId>.log`
3. `--follow` tails with fs watch or equivalent
4. Tests in `tests/cli/lane-logs.test.mjs`

**Closes:** [#50](https://github.com/beettlle/pi-spine/issues/50)

## Dependencies

- **Task:** SP-365 (live log path helpers)

## Context to Read First

- GitHub issue #50
- `src/batch/worker-output.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/cli/lane-logs.mjs`
- `bin/spine-cli/lane-logs.mjs`
- `bin/spine.mjs`
- `tests/cli/lane-logs.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/lane-logs.test.mjs` |
| fileScopeMustChange | `src/cli/lane-logs.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/cli/lane-logs.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-365 log path helpers exported

### Step 1: Implement lane logs command

- [ ] Add resolver and tail/follow in `src/cli/lane-logs.mjs`
- [ ] Wire `spine lane logs` subcommand in `bin/spine.mjs`

### Step 2: Tests

- [ ] Add `tests/cli/lane-logs.test.mjs`

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #50 (`gh issue close 50`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #50 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-366): complete Step N — description`

## Do NOT

- Expand scope beyond issue #50
