# SP-092: Cursor rules worker integration — Status

**Current Step:** 4
**Status:** ✅ Complete
**Last Updated:** 2026-06-04
**Review Level:** 2
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-091 + SP-073 satisfied (select + static FR-WORK-05 in worktree)
- [x] `SPINE_WORKER_STUB=1` path: `bin/spine-worker-runner.mjs --stub` exits early before `buildWorkerTailPrompt` (unchanged)

### Step 1: Async worker context
**Status:** ✅ Complete

- [x] `buildWorkerContextAsync` — committed manifest or `discoverCursorRules`; static fallback when no `.cursor/rules/`
- [x] `buildWorkerTailPrompt` + runner pass `taskFileScope` from packet parser / `SPINE_TASK_FILE_SCOPE`
- [x] `spine_review_step` after step (plan stub APPROVE)

### Step 2: Journal + stub safety
**Status:** ✅ Complete

- [x] `worker.rules_selected` journal fields (`mode`, `manifestSource`, `paths`, `entries`, `capped`, `globMatchEnabled`, `fileScopeProbeCount`, …)
- [x] Stub path unchanged (no rules build on `--stub`)
- [x] `spine_review_step` after step (code stub APPROVE)

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Tail includes critical-rules for JS-scoped task; `config.standards` append verified (`tests/batch/worker-prompt-rules.test.mjs`)
- [x] `SPINE_WORKER_STUB=1 npm test` — 495 pass; line coverage **83.84%** (≥77%)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] STATUS notes for agent-session `taskFileScope` / journal (below)
- [x] Discoveries logged in STATUS.md

## Discoveries

| # | Finding | Impact |
|---|---------|--------|
| 1 | `buildWorkerContextAsync` selects rules when `.cursor/rules/` exists; otherwise delegates to `buildWorkerContext` (static `referenceDocs` + `standards`). | Projects without Cursor rules keep SP-073 behavior. |
| 2 | `worker.rules_selected` emitted once per context build when `journal` context is provided (runner via `resolveBatchJournalContext`, agent session via `worker-host` batch params). | Operators can audit auto-selection in batch journal. |
| 3 | `SPINE_TASK_FILE_SCOPE` JSON env passes engine file scope to subprocess runner; agent session receives `taskFileScope` + `journal` directly from `spawnWorkerHandle`. | Both worker backends share PROMPT File Scope for glob match. |
| 4 | Large `taskplane-worker-cursor.mdc` can consume most of the 32KiB byte cap before glob-matched rules appear in tail text; `selection.paths` still lists full auto-selection. | Consider byte-aware ordering in a follow-up if needed. |
| 5 | `templates/agents/worker.md` auto-selected standards line deferred to SP-094. | Per PROMPT doc scope. |
