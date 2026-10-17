# SP-831: Planner sorts task IDs numerically — Status

**Current Step:** Step 4 — Documentation & Delivery
**Status:** ✅ Complete
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 1
**Iteration:** 3
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Task-ID sort sites confirmed
- [x] Dependencies satisfied

### Step 1: Numeric sorts
**Status:** ✅ Complete

- [x] Planner modules use `compareTaskIds`
- [x] `deps.mjs` nodes and edges use `compareTaskIds`

### Step 2: Tests
**Status:** ✅ Complete

- [x] Graph wave order and `remainingWithDeps`
- [x] Pending list order
- [x] `parseScope` order

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Lint
- [x] Contract `testCommand` (incl. stet)
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] `.DONE` in the task folder

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| GitNexus upstream impact: `buildGraph` (HIGH, 4 direct callers: `buildPlan`, `analyzeTasksScope`, `buildDepsReport`, `graph.mjs`), `topoWaves` (HIGH, 3 direct callers: `buildPlan`, `analyzeTasksScope`, `buildDepsReport`), `parseScope` (HIGH, 6 direct callers: `buildPlan`, `resolveBatchStartScope`, `resolveDepsScope`, `buildDepsReport`, `analyzeTasksScope`, `scope.mjs`), `filterPendingTaskIds` (CRITICAL, 3 direct callers: `summarizePendingScope`, `runSequence`, `analyzeTasksScope`) | Recorded; wave membership unchanged, only intra-wave / scope / pending task-ID sort order changed from lexicographic to numeric (`compareTaskIds`) | `src/planner/graph.mjs`, `src/planner/pending.mjs`, `src/planner/scope.mjs`, `src/cli/deps.mjs` |
| `rg -n '\.sort\(' src/planner src/cli/deps.mjs` confirmed all 9 task-ID sort sites match the Mission list (`graph.mjs` lines 42, 44, 74, 93, 99; `pending.mjs` line 26; `scope.mjs` lines 77, 138; `deps.mjs` lines 46, 59); no other `.sort(` calls exist in `src/planner` or `src/cli/deps.mjs` | Verified | `src/planner/`, `src/cli/deps.mjs` |
| Stet reviewer (`qwen/qwen3.8-27b`) emitted hunk-isolation false positives and out-of-scope / wrong-suggestion notes across runs (`e1bf2c2`, `7cdfeaf`, `e8bae2f`, `3d2ac90`, `aad5d2d`, `e7f975c`, `a571dba`, `e809cdf`, `74dc631`, `d6f6677`, `131e1ec`, `4594035`, `0404db1`, `3ebc640`, `1757410`, `a0e4121`, `7cfc4f4`, `c728d55`, `aee6cc5`) claiming `compareTaskIds` was missing/unexported or unused across separate diff hunks, questioning `||` comparator chaining, suggesting unrelated `Set` refactors, or questioning `discoverTasks` test fixtures | Dismissed (`false_positive` / `already_correct` / `wrong_suggestion` / `out_of_scope`) after verifying with `npm run lint`, `npm run typecheck`, and planner unit/integration tests | `.review/session.json` |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Step 0: GitNexus impact analysis & `rg` sort audit | Confirmed callers and all 9 sort sites in `src/planner` and `src/cli/deps.mjs` |
| 2026-10-17 | Step 1 & 2: Replace lexicographic task-ID sorts with `compareTaskIds` and add `SP-999` vs `SP-1000` tests | Committed in `37f22c1d` (`fix(SP-831): sort planner task IDs numerically (#352)`) |
| 2026-10-17 | Step 3: Run lint, typecheck, planner/boundary/cycle tests, and triage stet findings | All tests pass; stet false positives dismissed; `spine-stet-contract-run.sh lenient SP-831` exits 0 (`0 finding(s).`) with session open for engine contract gate |
| 2026-10-17 | Step 4: Log discoveries in `STATUS.md` and write `.DONE` | Ready for delivery |
