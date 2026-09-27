# SP-776: Type run-doctor-checks — Status

**Current Step:** Complete
**Status:** ✅ Done — Contract green
**Last Updated:** 2026-09-26
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-775 landed (`649de2f8` wave 1; 4 classify/diagnosis modules in tsconfig.batch.json include, allowlist rows gone)
- [x] Confirm nocheck on target (`src/doctor/run-doctor-checks.mjs` line 1)
- [x] Dependencies satisfied

### Step 1: Type run-doctor-checks
**Status:** ✅ Complete

- [x] Remove nocheck + JSDoc/casts (17 errors surfaced → 0; annotation-only)
- [x] Expand tsconfig.batch include (`src/doctor/run-doctor-checks.mjs` before `types/micromatch.d.ts`)
- [x] Shrink allowlist entry (1 row; only `run-doctor-checks.mjs` removed)
- [x] No #284 targets left allowlisted (`rg` on guard fixture returns nothing)

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] lint + Contract testCommand (lint exit 0; typecheck exit 0; batch tsc exit 0; targeted tests 41/41)
- [x] Full suite (worker env unset): 2651/2651 pass, 0 fail
- [x] Coverage gate ≥77%: **89.61%** (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run coverage:check`)
- [x] Fix failures: none (all green on first run)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged (below)
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Operator amendment 2026-09-26: `tsconfig.batch.json` + arch guard pre-changed on `main` by SP-774 | `fileScopeMustChange` redirected to `run-doctor-checks.mjs`; still edit tsconfig/allowlist in Step 1 |
| Step 0: SP-775 landed (`649de2f8`); no `.DONE` in its task dir but wave-1 land commit + tsconfig include + allowlist shrink all present | Dependencies satisfied; proceeded |
| Error surface 17 (vs 16 in `9942b782` probe): 11× TS7006 implicit-any params, 2× TS2339 `config.gates`/`config.testing` on `{object}` JSDoc, TS2339 `modelCheck.warning` on union member, TS18046 catch-var unknown, plus its param | Param/`@returns` JSDoc + 1 inline cast; no runtime edits |
| `checkModelProvider` returns 5-literal union; `modelCheck.warning` TS2339 on members lacking it | Explicit `@returns {{ ok, warning?, detail?, suggestedCommand? }}` widening |
| `loadSpineConfig` has no `@returns` JSDoc | `resolveTasksRoot` param typed `ReturnType<typeof loadSpineConfig>` |
| Catch var `err` is `unknown` under strict; `isListModelsTimeout` param typed `any` so the catch site passes through; `err.message` got `/** @type {Error} */` inline cast | Contained to the timeout helper + one catch block |
| LOC 597 → 635 (JSDoc only); `BATCH_MODULE_LOC_LIMIT` applies to `src/batch/*.mjs` only — file not subject to it | No split needed |
| Full-suite run rewrites `.spine/rules-manifest.json` (timestamp-only `generatedAt` bump) | Restored via `git checkout` — `.spine/` out of File Scope; pre-`.DONE` worktree clean |
| `gitnexus detect_changes`: 0 changed symbols in index baseline, risk low | Annotation-only diff confirmed |
| Step 2 evidence: lint 0; typecheck 0; batch tsc 0; Contract testCommand targeted 41/41; full suite 2651/2651; coverage **89.61%** ≥ 77% | Contract green |

## Completion Criteria

- [x] `run-doctor-checks.mjs` passes batch tsc without nocheck (`npx tsc --project tsconfig.batch.json --noEmit` exit 0)
- [x] No #284 target remains in `NOCHECK_ALLOWLIST` (guard `rg` empty; guard test green)
- [x] `spine doctor` behavior unchanged (doctor tests 41/41 in contract; full suite 2651/2651)
- [x] Contract green (lint, typecheck, batch tsc, testCommand, full suite, coverage 89.61%)
- [x] Closes #284

## Blockers

_None._
