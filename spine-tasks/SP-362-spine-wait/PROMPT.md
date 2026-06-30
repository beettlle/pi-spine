# Task: SP-362 — spine wait

**Created:** 2026-06-29
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CI wait helper reusing watch poll helper and reconcile diagnoses.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #46**: add `spine wait` — block until batch `diagnosis` reaches a target set (CI/automation).

**Required behavior:**

1. `spine wait --until completed,needs_integrate,failed,aborted [--timeout DURATION] [--json]`
2. Poll via shared reconcile loop (reuse SP-360 poll helper)
3. Exit 0 on match; exit 1 on timeout
4. `--json` emits final snapshot
5. CI example in operator runbook

**Closes:** [#46](https://github.com/beettlle/pi-spine/issues/46)

## Dependencies

- **Task:** SP-360 (shared poll helper / interval semantics)

## Context to Read First

- GitHub issue #46
- `src/cli/watch.mjs` (after SP-360)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/cli/wait.mjs`
- `bin/spine-cli/wait.mjs`
- `bin/spine.mjs`
- `tests/cli/wait.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/wait.test.mjs` |
| fileScopeMustChange | `src/cli/wait.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/cli/wait.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-360 poll helper is reusable

### Step 1: Implement wait command

- [ ] Add `src/cli/wait.mjs` with `--until` diagnosis set parsing
- [ ] Wire CLI router; timeout and exit codes

### Step 2: Tests and runbook

- [ ] Add `tests/cli/wait.test.mjs`
- [ ] CI example in runbook

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #46 (`gh issue close 46`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #46 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-362): complete Step N — description`

## Do NOT

- Expand scope beyond issue #46
