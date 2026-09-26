# SP-770: Type small engine-lanes + facade — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🔄 Finalizing
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
- [x] Dependencies satisfied

### Step 1 plan (Review Level 2)
1. Strip `// @ts-nocheck` line 1 from the 7 target files.
2. Add the 7 paths to `tsconfig.batch.json` include.
3. Remove the same 7 entries from `NOCHECK_ALLOWLIST` in the arch guard (keeps `found.length === allowlist.size` invariant).
4. Run `npx tsc --project tsconfig.batch.json --noEmit`; fix surfaced errors with compact JSDoc `@param`/`@returns` (pattern per SP-750). No new grandfather entries; review-* and matrix/merge stay nocheck.

### Step 1: Type small engine-lanes + facade
**Status:** ✅ Complete

- [x] Remove nocheck + JSDoc
- [x] Expand tsconfig.batch include
- [x] Shrink allowlist for this set only

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] lint + Contract testCommand
- [x] Fix failures

**Evidence:**
- `npm run lint` — clean (eslint `--max-warnings 0`, exit 0)
- `npm run typecheck` — both projects clean
- `npx tsc --project tsconfig.batch.json --noEmit` — 0 errors (was 98 after stripping nocheck)
- Contract guard test — 4/4 pass (`SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs`)
- Full `npm test` with worker env unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER`): **2651/2651 pass, 0 fail**. First run with worker env inherited failed 43 batch-spawning tests with `nested_batch_spawn_blocked` (SP-482 guard) — expected per PROMPT Step 2 note, not a code regression.
- LOC check: all 7 typed modules < 500 (`engine-lanes.mjs` 497, `queue.mjs` 242, rest ≤ 159). `PHASE23_GRANDFATHERED_OVER_500` untouched.
- Out-of-scope nocheck intact: matrix/matrix-run/merge/review-code/final/plan/poll each still carry exactly one `@ts-nocheck`.
- Reverted hook-regenerated `.spine/rules-manifest.json` timestamp (Do-NOT scope).

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Step 0: all 7 targets still carry `@ts-nocheck` on line 1 | Proceed as planned |
| `tsconfig.batch.json` include has 9 entries; no engine-lanes paths yet | Add 7 paths |
| Base tsconfig `strict: true`; batch tsc baseline green | Implicit anys will surface once checked |
| `docs/QUICK-REFERENCE.md` does not mention tsconfig.batch include | Check-If-Affected: not affected |
| Real-pi worker session (`SPINE_WORKER_RUNNER` set) | Skip in-worker `spine_review_step` calls; engine reviews after `.DONE` (SP-195) |
| 98 initial tsc errors across 6 files (review.mjs re-exports clean) | Fixed with inline JSDoc object types, `Record<string, any>` for dynamic state/task/lane/config, one `/** @type {any} */` cast on `runWorker` result (worker-host JSDoc lacks `@returns`) |
| `runMatrixTaskOnLane` JSDoc in matrix-run.mjs declares only `{ maxParallel: number }` (SP-772 scope) | Facade builds `matrixParams` const typed `{ maxParallel: number } & Record<string, any>` — no excess-property error, matrix-run untouched |
| `engine-scope.mjs countPlanTasks` JSDoc types `plan` as `import(...).buildPlan` function type (quirk in nocheck file, out of scope) | `params.plan` typed `any` in queue.mjs |
| `laneCorrelationId` required by commit.mjs contract | Made required in facade JSDoc; engine.mjs always passes it |
| `recordLaneTaskMetric` forwards `laneNumber` not declared by metrics.mjs JSDoc | Intermediate `metricParams` const avoids excess-property check on literal; behavior unchanged |
| | |

## Completion Criteria

- [x] Small modules + facade typed
- [x] Allowlist shrunk for this set
- [x] Partial #283

## Blockers

_None._
