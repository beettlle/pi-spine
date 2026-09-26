# SP-773: Document engine-lanes typing — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-26
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-772 landed
- [x] Dependencies satisfied

### Step 1: Document Phase 2 typing status
**Status:** ✅ Complete

- [x] Update QUICK-REFERENCE.md
- [x] Update operator-runbook.md

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Contract true + File Scope changed

### Step 3: Documentation & Delivery
**Status:** 🔄 In Progress

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| SP-772 merged on lane (`9f75dc61` type matrix/merge, `0035ea77` completion, merge `49966b25`); its STATUS confirms "Closes #283" | Dependency satisfied |
| `grep -rn '@ts-nocheck' src/batch/engine-lanes/` → no matches; `tsconfig.batch.json` includes `engine-lanes.mjs` facade + 13 modules | Preflight claim verified |
| `src/batch/engine-lanes/watch.mjs` is typed (no nocheck) but not in `tsconfig.batch.json` include — SP-772 STATUS documented this as intentional (already typed, out of scope) | Word docs as "engine-lanes modules plus facade included in batch typecheck; no `@ts-nocheck`" |
| `tsconfig.batch.json` also covers `state-io.mjs`, `state-guards.mjs`, `contract-exec.mjs`, `src/process/liveness.mjs` beyond the four modules the old runbook paragraph listed | Rewrote stale runbook typecheck paragraph |
| Arch guard lives at `tests/arch/ts-nocheck-guard.test.mjs` (`NOCHECK_ALLOWLIST`); other batch modules (reconcile/doctor clusters) still carry `@ts-nocheck` | Documented as #266 Phase 3 / #284 deferred |
| Contract `testCommand` (`true`) exit 0; File Scope both changed (`git status`: QUICK-REFERENCE.md + operator-runbook.md) | Step 2 verified |
| `SPINE_WORKER_STUB=1 npm test`: 2651 tests, 2608 pass / 43 fail — all `nested_batch_spawn_blocked` env class (`SPINE_IS_WORKER=1`), count parity with SP-772 baseline ("43 pre-existing env fails"); docs-only diff → zero regressions | Environmental, pre-existing |
| `npx tsc --project tsconfig.batch.json --noEmit` exit 0 | Doc claims about engine-lanes typing verified against reality |

## Completion Criteria

- [x] Docs note Phase 2 done / #284 deferred
- [ ] `.DONE` created

## Blockers

_None yet._
