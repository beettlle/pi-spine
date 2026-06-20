# Task: SP-321 — Atomic worker-output and .DONE

**Created:** 2026-06-20
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Worker completion signals (.DONE) and output logs can be torn on crash; aligns with SP-313 diagnosis work.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Harden worker-output logs and .DONE completion marker writes.

Update src/batch/worker-output.mjs, bin/spine-worker-runner.mjs, and src/batch/agent-session-worker.mjs to use atomic writes.

.DONE content: minimal JSON { taskId, completedAt } so engine can reject empty/partial files.

## Dependencies

1. **Task:** SP-318

## Context to Read First

- `src/batch/worker-output.mjs`
- `bin/spine-worker-runner.mjs`
- `src/batch/agent-session-worker.mjs`
- `spine-tasks/SP-313-worker-exit-without-done/PROMPT.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/worker-output.mjs`
- `bin/spine-worker-runner.mjs`
- `src/batch/agent-session-worker.mjs`
- `tests/batch/worker-output*.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/` |
| fileScopeMustChange | `src/batch/worker-output.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `(none beyond tests)` |

## Steps

### Step 0: Preflight

- [ ] Trace .DONE write and read paths across engine and workers
- [ ] Review SP-313 worker_done_missing behavior

### Step 1: Apply atomic writes to worker-output and .DONE

- [ ] Atomic write for worker-output logs
- [ ] Atomic write for .DONE with structured JSON content
- [ ] Update stub and agent-session workers consistently

### Step 2: Testing & Verification

- [ ] Test partial .DONE rejection if applicable
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

### Step 3: Documentation & Delivery

- [ ] Extend operator-runbook atomic writes section
- [ ] Create .DONE

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md`

**Check If Affected:**

- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] Worker-output and .DONE use atomic writes
- [ ] .DONE has structured content
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-321): complete Step N — description`
- `fix(SP-321): description`
- `test(SP-321): description`

## Do NOT

- Break existing .DONE detection for legacy empty files without migration path
- Change worker completion contract semantics

---

## Amendments (Added During Execution)
