# Task: SP-361 — spine journal follow

**Created:** 2026-06-29
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Journal tail wrapper using existing summarize helpers; no engine changes.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #45**: add `spine journal follow` — live pretty-printed tail of batch journal events.

**Required behavior:**

1. `spine journal follow [--batch ID] [--lane lane-N] [--json]`
2. Human lines use `summarizeJournalEvent` (same as replay)
3. Default batch from active reconcile / batch-state
4. `--lane` filters by laneId
5. Missing journal exits non-zero with clear message

**Closes:** [#45](https://github.com/beettlle/pi-spine/issues/45)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #45
- `bin/spine-journal.mjs`, `src/batch/journal.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/cli/journal-follow.mjs`
- `bin/spine-journal.mjs`
- `tests/cli/journal-follow.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/journal-follow.test.mjs` |
| fileScopeMustChange | `src/cli/journal-follow.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/cli/journal-follow.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read journal replay formatting and path resolution

### Step 1: Implement journal follow

- [ ] Add `src/cli/journal-follow.mjs` with tail -f semantics
- [ ] Extend `bin/spine-journal.mjs` subcommand routing
- [ ] Lane filter and `--json` raw passthrough

### Step 2: Tests

- [ ] Add `tests/cli/journal-follow.test.mjs`

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #45 (`gh issue close 45`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #45 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-361): complete Step N — description`

## Do NOT

- Expand scope beyond issue #45
- Add parallel journal parsing logic
