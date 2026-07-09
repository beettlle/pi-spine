# Task: SP-548 — Subprocess heartbeat observability

**Created:** 2026-07-08
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Heartbeat payload enrichment during long subprocess steps.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

When a worker runs a long subprocess (test suite, coverage, typecheck), emit heartbeat/progress signals so the dashboard does not go dark. Surface subprocess phase in `lane.heartbeat` payload (e.g. `workerPhase: "subprocess"`, `subprocessCommand` redacted summary).

**Closes:** [#134](https://github.com/beettlle/pi-spine/issues/134)

## Dependencies

- SP-543

## Context to Read First

- `src/batch/heartbeat.mjs`
- `src/dashboard/snapshot.mjs`
- `tests/batch/heartbeat-git-debounce.test.mjs`

## File Scope

- `src/batch/heartbeat.mjs`
- `src/dashboard/snapshot.mjs`
- `tests/batch/heartbeat-subprocess.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/heartbeat-subprocess.test.mjs tests/batch/heartbeat-git-debounce.test.mjs` |
| fileScopeMustChange | `src/batch/heartbeat.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #134 timeline (worker_alive with null payload during npm run coverage)

### Step 1: Subprocess heartbeat kind

- [ ] Extend heartbeat builder to accept subprocess phase signals from worker/checkpoint path
- [ ] Include non-sensitive subprocess label in journal payload
- [ ] Do not increase git porcelain polling frequency (respect SP-455 debounce)

**Artifacts:**
- `src/batch/heartbeat.mjs` (modified)

### Step 2: Dashboard display

- [ ] Expose subprocess phase in snapshot lane meta when present
- [ ] Format display string (e.g. `running tests (3m)`) in dashboard view helpers

**Artifacts:**
- `src/dashboard/snapshot.mjs` (modified)

### Step 3: Tests

- [ ] Add `tests/batch/heartbeat-subprocess.test.mjs` for payload + snapshot wiring

**Artifacts:**
- `tests/batch/heartbeat-subprocess.test.mjs`

### Step 4: Testing & Verification

- [ ] `node --test tests/batch/heartbeat-subprocess.test.mjs tests/batch/heartbeat-git-debounce.test.mjs`
- [ ] `npm run typecheck`

### Step 5: Documentation & Delivery

- [ ] Close #134
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Long subprocess steps produce meaningful heartbeat/progress in dashboard

## Git Commit Convention

- `feat(SP-548): subprocess heartbeat observability`

## Do NOT

- Log full command lines with secrets
