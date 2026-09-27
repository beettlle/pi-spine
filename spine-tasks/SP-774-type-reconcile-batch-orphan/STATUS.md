# SP-774: Type reconcile-batch/orphan + reconcile facade — Status

**Current Step:** Step 1 — Type reconcile facade + batch/orphan
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-26
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm nocheck on targets
- [x] Note tsconfig/allowlist state
- [x] Record reconcile-batch LOC baseline
- [x] Dependencies satisfied

### Step 1: Type reconcile facade + batch/orphan
**Status:** ✅ Complete
> ⚠️ Hydrate: Expand based on tsc errors surfaced after stripping nocheck

Step 1 plan (Review Level 2):
1. Strip `// @ts-nocheck` line 1 from `reconcile.mjs`, `reconcile-batch.mjs`, `reconcile-orphan.mjs` (net −1 LOC each).
2. Add the 3 paths to `tsconfig.batch.json` include before `types/micromatch.d.ts`; remove the same 3 entries from `NOCHECK_ALLOWLIST` (invariant: found.length === allowlist.size; lines 104–107 + attached-runner-reconcile stay).
3. Fix surfaced tsc errors: `Record<string, any>` for `signals` literal (dynamic props) and mutated `state` objects (state-guards pattern); inline `/** @type {any} */` casts only where JSDoc of imports is stale. Inline casts preferred over new lines — reconcile-batch.mjs budget is 492−1(nocheck)+7 = ≤499.
4. Leave classify/diagnosis*/light-cache/doctor untouched (SP-775/776).

- [x] Remove nocheck + JSDoc/casts
- [x] Expand tsconfig.batch include
- [x] Shrink allowlist for this set only
- [x] reconcile-batch.mjs ≤ 499 lines

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] lint + Contract testCommand
- [ ] Full suite (worker env unset)
- [ ] Coverage gate ≥77%
- [ ] Fix failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Step 0: all 3 targets still carry `@ts-nocheck` on line 1; `reconcile-batch.mjs` at 492 LOC baseline | Proceed as planned |
| `tsconfig.batch.json` include had 22 entries, no reconcile paths; allowlist rows at test lines 103/108/109 | Added 3 include paths before `types/micromatch.d.ts`; removed exactly those 3 allowlist rows |
| Real-pi worker session (`SPINE_WORKER_RUNNER` set) | Skip in-worker `spine_review_step` calls; engine reviews after `.DONE` (SP-195/SP-770 precedent) |
| `gitnexus impact` on `reconcileBatch`: CRITICAL (16 direct callers, 9 processes) | Change is annotation-only (no runtime/signature change, per PROMPT Do-NOT); mitigated by full 2651-test suite + contract tests |
| 76 tsc errors after strip: 43 batch / 33 orphan / 0 facade (matches probe) | Root causes: untyped `classifyTasks` result, dynamically-extended `signals` literal, `object` JSDoc params on orphan helpers, stale JSDoc in out-of-scope nocheck deps |
| TS behavior verified by probe: `.find((x) => …)` on an `any` callee still raises TS7006; a receiver cast to a typed array gives contextual typing | Cast receivers to typed arrays, not blanket `any` |
| `signals` grows 15+ dynamic props (journalHints/stateDrift/orphanRunning/postMergeLimbo/…) | `const signals = /** @type {Record<string, any>} */ ({…})` inline — 0 net LOC (state-guards pattern) |
| `classifyTasks` consumers disagree: detectOrphanRunning wants `classification: string` required; DiagnosisTaskRow has it optional; journal-rebuild-drift JSDoc infers `null\|undefined`/`never[]` from default-value params (broken upstream, file out of scope) | `classifiedTasks` typed `{ taskId: string, classification: string, laneNumber?: number\|null }[]`; `detectBatchStateDrift` call args get `/** @type {any} */` casts (journal-rebuild*.mjs untouched, SP-775+/future scope) |
| `batch.raw` fields loosely typed (`{}`) in parseBatchState JSDoc (batch-state-io.mjs out of scope) | Per-site receiver/value casts on `mergeResults`/`lastError`/`tasks` access only |
| LOC: compaction of multi-line casts kept batch file at 487 (budget ≤499); orphan 303; facade 40 | All well under 500 policy; `PHASE23_GRANDFATHERED_OVER_500` untouched |

## Completion Criteria

- [ ] Three modules typed
- [ ] Allowlist shrunk for this set
- [ ] Partial #284

## Blockers

_None yet._
