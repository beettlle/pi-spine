# Task: SP-360 — spine watch

**Created:** 2026-06-29
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CLI poll loop wrapping existing reconcile; single new command surface.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #44**: add `spine watch` — foreground poll over `reconcileBatch` for live batch monitoring without ad-hoc `watch spine status --diagnose` scripts.

**Required behavior:**

1. `spine watch [--interval SEC] [--json] [--once]`
2. Human mode: compact one-line refresh (diagnosis, batchId, macro phase, headline)
3. `--json`: newline-delimited JSON snapshots (include progress fields from SP-339 / #30 when available)
4. Default interval 5s
5. Document in operator runbook §3 Monitor

**Closes:** [#44](https://github.com/beettlle/pi-spine/issues/44)

## Dependencies

- **None** (benefits from SP-339 progress JSON when landed)

## Context to Read First

- GitHub issue #44
- Epic #43
- `bin/spine-status.mjs`, `src/batch/reconcile.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/cli/watch.mjs`
- `bin/spine-cli/watch.mjs`
- `bin/spine.mjs`
- `tests/cli/watch.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/watch.test.mjs` |
| fileScopeMustChange | `src/cli/watch.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/cli/watch.test.mjs` |

## Steps

### Step 0: Preflight: audit reconcile JSON shape

- [ ] Read `runSpineStatus` and reconcile output fields used by watch

### Step 1: Implement watch command

- [ ] Add `src/cli/watch.mjs` with interval loop calling `reconcileBatch`
- [ ] Wire `bin/spine-cli/watch.mjs` and router in `bin/spine.mjs`
- [ ] Human and `--json` output modes; `--once` for single snapshot

### Step 2: Tests and runbook

- [ ] Add `tests/cli/watch.test.mjs`
- [ ] Document command in `docs/adoption/operator-runbook.md`

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #44 (`gh issue close 44`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #44 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-360): complete Step N — description`
- `fix(SP-360): description`
- `test(SP-360): description`

## Do NOT

- Expand scope beyond issue #44 acceptance criteria
- Duplicate reconcile logic outside `reconcileBatch`
