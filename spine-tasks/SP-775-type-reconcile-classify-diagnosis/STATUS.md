# SP-775: Type reconcile classify/diagnosis/context/light-cache — Status

**Current Step:** Complete
**Status:** ✅ Done — Contract green
**Last Updated:** 2026-09-26
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-774 landed (`f603e5c1`, merge `b0fe8e23`; `reconcile.mjs`/`reconcile-batch.mjs`/`reconcile-orphan.mjs` in tsconfig.batch.json include)
- [x] Confirm nocheck on targets (all 4 modules line 1; LOC 433/384/88/61)
- [x] Dependencies satisfied

### Step 1: Type classify/diagnosis cluster
**Status:** ✅ Complete
> ⚠️ Hydrate: Expand based on tsc errors surfaced after stripping nocheck

- [x] Remove nocheck + JSDoc/casts (only 3 errors post-annotation vs 119 probe — SP-774 patterns absorbed most; see Discoveries)
- [x] Expand tsconfig.batch include (4 paths before `types/micromatch.d.ts`)
- [x] Shrink allowlist for this set only (4 rows; 100→96 lines in guard fixture)
- [x] LOC under policy limit (443/383/87/60; `PHASE23_GRANDFATHERED_OVER_500` untouched)

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] lint + Contract testCommand (lint clean; 69/69 arch+diagnosis+light+macro)
- [x] Full suite (worker env unset): 2651/2651 pass, 0 fail
- [x] Coverage gate ≥77%: **89.67%** (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run coverage:check`)
- [x] Fix failures: 1st full-suite run had 1 flaky assert in `reviewer-artifact-early-honor.test.mjs` (out of scope, imports none of the touched modules, passes 3/3 isolated; 2nd full run clean)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged (below)
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Step 0: SP-774 landed (`f603e5c1`, merge `b0fe8e23`); its 3 reconcile modules in tsconfig include; all 4 SP-775 targets still nocheck line 1; LOC 433/384/88/61 | Proceed as planned |
| Error surface collapsed vs probe (119 → 3): `{object}` → `Record<string, any>` on `signals`/`params`/`classified`/`state`/`ctx` + receiver casts absorbed nearly everything; classify needed 8 untyped-helper JSDoc additions (strict checkJs) | Reused SP-774 patterns exclusively; no new technique |
| `findPendingLaneLandTasks` (nocheck dep) infers `object[]` return → `pendingLaneLandTasks[0]?.taskId` TS2339 | `/** @type {any} */` receiver cast at the `deriveDiagnosis` call site (dep file untouched) |
| `inspectGitState` result literal under strict: `orchBranches: []` → `never[]`, null-typed fields reject string/number writes | `const result = /** @type {Record<string, any>} */ ({…})` inline cast |
| `findPostDonePlanReviewSpawnFailedTask` `@returns {object|null}` → `.taskId` TS2339 | Widened JSDoc to `Record<string, any>|null` (module-private fn) |
| Edit mishap: 2 JSDoc rewrites initially dropped the `export function` lines (`listHumanOnlyPaths`, `inspectHumanBaseSync`) | Caught immediately by `node -e import()` smoke test; signatures restored before any commit of broken state |
| 1st full-suite run: 1 flaky assert in `reviewer-artifact-early-honor.test.mjs` (timing-sensitive); file imports none of the touched modules; 3/3 pass isolated | 2nd full run 2651/2651 clean — pre-existing flake, not a regression |
| `gitnexus detect_changes`: 19 symbols touched, 4 affected processes (git-inspection flow), risk medium | Annotation-only; diagnosis/classification logic unchanged; mitigated by full suite + contract |
| LOC after typing: 443/383/87/60 — all ≤500 | `PHASE23_GRANDFATHERED_OVER_500` untouched |
| Step 2 evidence: lint exit 0; `npm run typecheck` exit 0; batch tsc exit 0; Contract testCommand 69/69; full suite 2651/2651 (worker env unset); coverage **89.67%** ≥ 77% | Contract green |

## Completion Criteria

- [x] Four modules pass batch tsc without nocheck (`npx tsc --project tsconfig.batch.json --noEmit` exit 0)
- [x] Allowlist shrunk for those modules only (4 rows removed; guard test green)
- [x] Diagnosis output unchanged (diagnosis/light/macro contract tests 69/69; full suite 2651/2651)
- [x] Contract green (lint, typecheck, batch tsc, testCommand, full suite, coverage 89.67%)
- [x] Partial #284

## Blockers

_None._
