# SP-771: Type review-* engine-lanes — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** ✅ Complete
**Last Updated:** 2026-09-26
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-770 landed (`4c60aa78` + `.DONE` on main; small modules absent from allowlist)
- [x] Confirm four review-* still nocheck (all four carried `// @ts-nocheck`; all four in allowlist lines 69–72)
- [x] Dependencies satisfied

### Step 1: Type review-* engine-lanes
**Status:** ✅ Complete

- [x] Remove nocheck + JSDoc
- [x] Expand tsconfig.batch include
- [x] Shrink allowlist for four modules

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] lint + Contract testCommand (all green: eslint 0 warnings; typecheck both projects; batch tsc 0 errors; arch guard 4/4)
- [x] Fix failures (10 initial tsc errors fixed — see Discoveries)
- [x] Full `npm test`: 2651/2651 pass, 0 fail (worker env vars unset per nested-spawn-guard note)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] Create `.DONE`

## Implementation Summary (Step 1)

Followed SP-770 house style (`Record<string, any>` for mutated batch-state params):

- **review-poll.mjs** (typed first — the other three depend on it): filled `@param` stubs on `appendReviewHonorJournalEvents`, `honorCompletedReview`, `runReviewPollLoop`. `runEngineReview: (reviewParams: Record<string, any>) => any` (precise type required — bare `Function` made caller arrows implicitly-any); `beforeReview` typed `(hookParams: { attempt: number }) => Promise<{ abort?: any, extraReviewParams?: Record<string, any> } | undefined> | null`; `runWorker` result `/** @type {any} */` cast (house pattern from `engine-lanes.mjs` — inferred union lacks `classification` on every member).
- **review-plan.mjs / review-code.mjs / review-final.mjs**: removed nocheck; filled `@param` stubs on `runEngine*Review`, `record*TaskFailure`; `stubVerdicts: { next: () => string } | null`.
- **tsconfig.batch.json**: +4 `src/batch/engine-lanes/review-*.mjs` include paths.
- **tests/arch/ts-nocheck-guard.test.mjs**: −4 allowlist entries. No grandfather growth.

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| SP-770 `.DONE` on main (`4c60aa78`); small modules + facade off allowlist | Preflight pass; proceed |
| `runWorker` JSDoc types `onHeartbeat`/`onWorkerPid` callbacks (`number`) | Callback bodies typecheck without casts |
| `runWorker` return type is an inferred union without `classification` on every member | `/** @type {any} */` cast per `engine-lanes.mjs` precedent |
| LOC 500 cap scans `src/batch/*.mjs` non-recursively (`loc-capstone.mjs:29-40`); `PHASE23_GRANDFATHERED_OVER_500` is empty | engine-lanes/ JSDoc growth out of policy scope |
| `{...record}` spreads and `Record<string, any>` do NOT satisfy required props in TS 6 (probe-verified), but intrinsic `object` → all-optional/Record types does | Phase fns take `@param {Record<string, any>} params` with keys in prose — `resume-lane-reviews.mjs` forwards a loose `object` bag and IS in the tsc program (contrary to import-graph guess) |
| Bare `@param {Function}` on `runEngineReview` made `(params) => ...` caller arrows implicitly-any | Typed as `(reviewParams: Record<string, any>) => any` |
| `review-artifacts.mjs` `resolveReviewHonorJournalEvent` JSDoc still narrows reviewType to `"code"\|"final"` (predates plan phase); file out of scope | Cast at the review-poll call site with a why-comment |
| `parseReviewVerdict` inferred union spans code/final verdicts; object property capture defeats narrowing | One `/** @type {"APPROVE"\|"REVISE"} */` cast on the `artifactMatch` verdict property with why-comment |
| Subfield `@param` docs require `@param {object}` top type (TS8032) | Record-typed params carry keys in prose instead |

## Verification Evidence

- `npm run lint` — clean (0 warnings, `--max-warnings 0`)
- `npm run typecheck` — both tsconfig.json and tsconfig.batch.json, 0 errors
- `npx tsc --project tsconfig.batch.json --noEmit` — 0 errors
- `SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs` — 4/4 pass (allowlist live, no new nocheck, count matches)
- `npm test` — 2651/2651 pass
- GitNexus `detect_changes` vs `b05f236c` — only the four review-* modules (plus tsconfig/guard-test/STATUS) touched; affected processes are exactly the plan/code/final review-phase flows

## Completion Criteria

- [x] Four review-* modules typed (batch tsc green without nocheck)
- [x] Allowlist shrunk (−4 entries; guard 4/4)
- [x] Partial #283

## Blockers

_None._
