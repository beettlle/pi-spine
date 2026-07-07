# Task: SP-513 — Pause resume SIGTERM engine orphan fix

**Created:** 2026-07-07
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Attached engine lifecycle; pause/resume SIGTERM path.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix [#184](https://github.com/beettlle/pi-spine/issues/184): batch `20260706T052912` entered `engine_orphaned` after operator pause/resume during contract retry. Engine received SIGTERM while paused; resume left tasks with lane `.DONE` but batch-state `running`.

**Closes:** [#184](https://github.com/beettlle/pi-spine/issues/184)

## Dependencies

- SP-511

## Context to Read First

- GitHub [#184](https://github.com/beettlle/pi-spine/issues/184)
- `spine-tasks/_explore/reconciliation-v181/findings.md`
- `src/batch/attached-runner.mjs`, `src/batch/orphan-detect.mjs`, `src/batch/attached-engine-handoff.mjs`

## File Scope

- `src/batch/attached-runner.mjs`
- `src/batch/orphan-detect.mjs`
- `tests/batch/attached-pause-resume-sigterm.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/attached-pause-resume-sigterm.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/attached-runner.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read #184 journal excerpt and SP-511 findings

### Step 1: Engine fix

- [ ] Paused batch resume must not leave orphan when prior engine received SIGTERM during pause
- [ ] Reconcile lane `.DONE` after resume when contract verified

### Step 2: Tests

- [ ] Add `attached-pause-resume-sigterm.test.mjs` simulating pause → SIGTERM → resume

### Step 3: Testing & Verification

- [ ] Run contract testCommand

### Step 4: Documentation & Delivery

- [ ] Close #184
- [ ] Create `.DONE`

## Completion Criteria

- [ ] One pause/resume cycle does not produce `engine_orphaned` in regression test

## Do NOT

- Change detached resume defaults (v1.10.0 scope)
- Hand-edit batch-state JSON in tests — use journal replay
