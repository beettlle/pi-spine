# Task: SP-337 — Dismiss orphan worker kill

**Created:** 2026-06-28
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** `batch dismiss` archives state but worker subprocesses keep running after batch archived.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #28**: orphaned worker subprocesses survive `spine batch dismiss`, consuming resources and confusing operators.

**Required behavior:**

1. On dismiss (and hard abort), terminate lane worker PIDs tracked in batch state.
2. Journal `lane.worker_terminated` on forced kill during dismiss.
3. Regression test: dismiss kills stub worker PID.

**Closes:** [#28](https://github.com/beettlle/pi-spine/issues/28)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #28
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/lifecycle.mjs`
- `src/batch/abort.mjs`
- `src/batch/worker-host.mjs`
- `tests/batch/dismiss-orphan-worker-kill.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/dismiss-orphan-worker-kill.test.mjs` |
| fileScopeMustChange | `src/batch/lifecycle.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/dismiss-orphan-worker-kill.test.mjs` |

## Steps

### Step 0: Preflight: trace dismiss vs worker PIDs

- [ ] Preflight: trace dismiss vs worker PIDs

### Step 1: Kill workers on dismiss

- [ ] Kill workers on dismiss

### Step 2: Tests + delivery

- [ ] Tests + delivery

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #28 (`gh issue close 28`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #28 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-337): complete Step N — description`
- `fix(SP-337): description`
- `test(SP-337): description`

## Do NOT

- Expand scope beyond issue #28 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
