# Task: SP-345 — Transient orphan debounce

**Created:** 2026-06-28
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** `worker_orphaned` diagnosis appears while task still `running` and later succeeds without retry.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #36**: batch `20260628T051158` reported `worker_orphaned` for SP-137 while task was still `running`; false alarm mid-wave.

**Required behavior:**

1. Debounce orphan diagnosis during `task.started` → first heartbeat window.
2. Do not suggest `batch retry` until orphan reconcile confirms dead PID.
3. Regression test: fast stub lane completion without orphan diagnosis.

**Closes:** [#36](https://github.com/beettlle/pi-spine/issues/36)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #36
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/orphan-detect.mjs`
- `src/batch/reconcile.mjs`
- `src/batch/diagnosis.mjs`
- `tests/batch/transient-orphan-debounce.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/transient-orphan-debounce.test.mjs` |
| fileScopeMustChange | `src/batch/orphan-detect.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/transient-orphan-debounce.test.mjs` |

## Steps

### Step 0: Preflight: SP-137 mid-batch diagnose dump

- [ ] Preflight: SP-137 mid-batch diagnose dump

### Step 1: Orphan debounce window

- [ ] Orphan debounce window

### Step 2: Tests + delivery

- [ ] Tests + delivery

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #36 (`gh issue close 36`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #36 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-345): complete Step N — description`
- `fix(SP-345): description`
- `test(SP-345): description`

## Do NOT

- Expand scope beyond issue #36 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
