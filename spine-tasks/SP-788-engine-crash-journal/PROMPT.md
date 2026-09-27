# Task: SP-788 — Engine crash journaling

**Created:** 2026-09-27
**Size:** S

## Review Level: 2 (Plan and Code)

**Risk:** Process-wide handlers in the attached engine; a leaky install would also fire inside the test runner or swallow real crashes.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 1
**Problem theory:** No `uncaughtException` / `unhandledRejection` handler exists anywhere in `src/` or `bin/`. When the attached batch engine crashes, the journal gets no terminal event and batch-state stays `running`, so operators see an orphan instead of a crash.

## Mission

Partial #306 — An attached-engine crash journals `engine.crashed`, marks the batch failed, and exits non-zero. (SP-787 covers the spawn-level causes.)

1. **New module** `src/batch/engine-crash-guard.mjs` exporting `installEngineCrashHandlers({ projectRoot, deps })`, which registers `uncaughtException` and `unhandledRejection` listeners and **returns an uninstall function**. `deps` (all optional, defaults to real implementations) = `{ appendJournalEvent, markBatchFailed, exit, now }` so tests never touch real process exit.
2. **Handler behavior** (run once, re-entrancy guarded): resolve the active batch id; journal `engine.crashed` with `{ kind: "uncaughtException" | "unhandledRejection", error: <message, capped 500 chars>, stack: <first ~20 lines> }`; mark the batch failed (set `phase = "failed"`, `endedAt`, `lastError` via `saveSpineBatchState`, same fields as the existing failed paths in `resume.mjs`); then `exit(1)`. If journaling or state save itself throws, still exit non-zero and write the original error to stderr — never swallow.
3. **Wire in** `runAttachedBatchEngine` (`src/batch/attached-runner-promote.mjs`): install right after `installAttachedExitFinalizeHandlers`, uninstall in the existing `finally`. `attached-runner-promote.mjs` is 454 lines — keep the change to a few lines.
4. **Tests** in a new file: invoke the installed listener directly (e.g. `process.listeners("uncaughtException").at(-1)`, or call an exported handler factory) with fake deps — assert `engine.crashed` journaled, state `phase: "failed"`, `exit(1)` called once; uninstall removes both listeners; a throwing journal still calls `exit(1)`. Never emit a real uncaught exception in the test runner.

## Dependencies

- **None**

## Context to Read First

- `src/batch/attached-runner-promote.mjs` — `installAttachedExitFinalizeHandlers` (~line 125), `runAttachedBatchEngine` (~line 263)
- `src/batch/resume.mjs` ~lines 354–372 — failed-state field pattern
- `src/batch/state.mjs` / `src/batch/state-io.mjs` — `loadSpineBatchState`, `saveSpineBatchState`
- `src/batch/journal.mjs` — `appendJournalEvent`
- GitHub #306 (item 5)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`)

## File Scope

- `src/batch/engine-crash-guard.mjs`
- `src/batch/attached-runner-promote.mjs`
- `tests/batch/engine-crash-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/engine-crash-guard.test.mjs tests/batch/resume-engine-crash.test.mjs` |
| fileScopeMustChange | `src/batch/engine-crash-guard.mjs`, `tests/batch/engine-crash-guard.test.mjs` |
| fileScopeMustNotChange | `src/batch/worker-spawn.mjs`, `src/batch/worker-host.mjs`, `src/batch/worker-output.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm no crash handlers exist: `rg -n "uncaughtException|unhandledRejection" src bin`
- [ ] Check whether `tsconfig.batch.json` type-checks new `src/batch/*.mjs` files (if so, no `// @ts-nocheck` in the new module)
- [ ] Dependencies satisfied

### Step 1: Crash guard module + wiring

- [ ] `installEngineCrashHandlers` with injectable deps; returns uninstall
- [ ] Journals `engine.crashed`, marks batch failed, exits 1; once-only; never swallows
- [ ] Installed in `runAttachedBatchEngine`, uninstalled in `finally`

**Artifacts:**
- `src/batch/engine-crash-guard.mjs` (new)
- `src/batch/attached-runner-promote.mjs` (modified)

### Step 2: Tests

- [ ] Handler journals + marks failed + exits once (fake deps)
- [ ] Uninstall removes listeners
- [ ] Failing journal still exits non-zero

**Artifacts:**
- `tests/batch/engine-crash-guard.test.mjs` (new)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-789 owns runbook edits)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` "Resume engine crash (fail-closed)"

## Completion Criteria

- [ ] Attached-engine crashes are journaled as `engine.crashed` and leave the batch `failed`
- [ ] Handlers are scoped to the engine run (no leak into importers/tests)
- [ ] Partial #306 (SP-787 closes)

## Git Commit Convention

- `fix(SP-788): journal attached engine crashes and mark batch failed (#306)`

## Do NOT

- Register handlers at module import time or in `bin/spine.mjs` globally
- Edit worker spawn/output modules (SP-787)
- Keep the process alive after an uncaught exception
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
