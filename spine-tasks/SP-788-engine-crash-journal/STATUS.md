# SP-788: Engine crash journaling — Status

**Current Step:** Step 1 (Crash guard module + wiring)
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Confirm no crash handlers
- [x] Check batch typecheck coverage for new module
- [x] Dependencies satisfied

### Step 1: Crash guard module + wiring
**Status:** ✅ Done

**Plan:**
- `installEngineCrashHandlers({ projectRoot, deps })` in new `src/batch/engine-crash-guard.mjs`. Deps `{ appendJournalEvent, markBatchFailed, exit, now }` default to real impls; returns uninstall removing both listeners.
- Handler: re-entrancy flag; resolve batchId via `loadSpineBatchState(projectRoot).raw?.batchId`; journal `engine.crashed` `{ kind, error ≤500 chars, stack ≤20 lines }`; default `markBatchFailed` sets `phase="failed"`, `endedAt`, `lastError` (sliced 500) via `saveSpineBatchState` (same fields as `resume.mjs` failed paths); then `exit(1)`. Journal/mark wrapped in try/catch — on throw write original error to stderr and still `exit(1)`. No active batchId → stderr note + `exit(1)`, never swallow.
- Wiring: install right after `installAttachedExitFinalizeHandlers` in `runAttachedBatchEngine`; `uninstallEngineCrashGuard()` first line of existing `finally`.
- Impact check: `runAttachedBatchEngine` called by `bin/spine-batch.mjs`, `src/batch/attached-runner.mjs`, 2 tests — LOW risk (scoped install/uninstall).

- [ ] Injectable install/uninstall
- [ ] Journal + mark failed + exit once
- [ ] Wired in `runAttachedBatchEngine`

### Step 2: Tests
**Status:** ✅ Done

- [x] Handler behavior
- [x] Uninstall
- [x] Failing journal still exits

9 tests: journal+mark+exit once, rejection kind, re-entrancy, uninstall removes both listeners, throwing journal → exit 1 + stderr, throwing markBatchFailed → exit 1, no active batch → exit 1, 500-char/20-line caps, default markBatchFailed real-I/O path.

### Step 3: Testing & Verification
**Status:** ✅ Done

- [x] Lint
- [x] Contract `testCommand`
- [x] Batch suite
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** 🔄 In Progress

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| Finding | Impact |
|---------|--------|
| No `uncaughtException`/`unhandledRejection` handlers in `src/` or `bin/` (rg exit 1) — confirms problem theory | — |
| `tsconfig.batch.json` type-checks an explicit file list; `attached-runner-promote.mjs` and the new module are not in it — no `// @ts-nocheck` needed either way; verified via Contract testCommand in Step 3 | None |
| Existing fail-closed pattern: `failBatchFromEngineError` in `state.mjs` sets `endedAt`/`lastError` (sliced 500)/`phase="failed"` — mirrored in default `markBatchFailed` | Informs design |
| New module IS transitively type-checked (`npm run typecheck` failed with 5 TS7006 implicit-any errors before inline JSDoc casts) — no `@ts-nocheck` used | Fixed in Step 3 |
| Lint `--max-warnings 0` caught unused `batchId` param in `defaultMarkBatchFailed` — fixed with a real guard: never fail a batch other than the one resolved at crash time | Fixed in Step 3 |
| `docs/adoption/operator-runbook.md` "Resume engine crash (fail-closed)" (line ~1776) covers the detached-engine path only — SP-789 should extend it with the attached-engine `engine.crashed` behavior | Delegated to SP-789 |

## Blockers

_None._
