# SP-771: Type review-* engine-lanes — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-26
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-770 landed (`4c60aa78` + `.DONE` on main; small modules absent from allowlist)
- [x] Confirm four review-* still nocheck (all four carry `// @ts-nocheck`; all four in allowlist lines 69–72)
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

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

## Implementation Plan (Step 1)

Follow SP-770 house style (`Record<string, any>` for mutated batch-state params — see `state-guards.mjs`, `queue.mjs`, `engine-lanes.mjs`):

1. **review-poll.mjs** (typed first — plan/code/final depend on it):
   - Remove `// @ts-nocheck`; fill existing `@param {object} params` stubs:
     - `appendReviewHonorJournalEvents`: task/lane/honored → `Record<string, any>`.
     - `honorCompletedReview`: state/task/lane → `Record<string, any>`; `journalEvents: Array<Record<string, any>>`; `findCompletedReview: Function`; `@returns {{ ok: boolean, [key: string]: any } | null}` (computed `[attemptKey]` prop).
     - `runReviewPollLoop`: full params doc; `runEngineReview: (reviewParams: Record<string, any>) => any` (precise type required — bare `Function` would make caller arrows implicitly-any); `beforeReview: (hookParams: { attempt: number }) => Promise<{ abort?: any, extraReviewParams?: Record<string, any> } | undefined>`; `@returns {Promise<{ ok: boolean, [key: string]: any }>}`.
     - `runWorker` result: `/** @type {any} */` cast (house pattern from `engine-lanes.mjs:288`) — inferred union lacks `classification` on all members.
2. **review-plan.mjs / review-code.mjs / review-final.mjs** (mechanical mirrors):
   - Remove `// @ts-nocheck`; fill `@param` stubs on `runEngine*Review`, `record*TaskFailure`, `run*Phase` (phase params mirror `engine-lanes.mjs runNonMatrixTaskOnLane` exactly: state/task/lane/config `Record<string, any>`, `fileScopePaths: string[]`, `baseBranch` optional on final).
   - `stubVerdicts: { next: () => string } | null` (only `.next()` consumed).
   - review-plan `findCompletedPlanReview`: `journalEvents` → `Array<Record<string, any>>` (existing `object[]` blocks `event.taskId` access); existing `@type`/casts kept.
3. **tsconfig.batch.json**: add the four `src/batch/engine-lanes/review-*.mjs` paths (alphabetical, after `queue.mjs`).
4. **tests/arch/ts-nocheck-guard.test.mjs**: delete the four allowlist entries (lines 69–72). No new entries.

Risk notes (verified):
- `resume-lane-reviews.mjs` passes plain `object` to the phase fns but is not reachable from the tsconfig.batch include closure (imported only by resume.mjs / resume-multi-lanes.mjs, which nothing in the include set imports) — tsc will confirm.
- LOC policy counts only top-level `src/batch/*.mjs` (non-recursive), so engine-lanes/ additions are out of capstone scope; additions kept compact anyway.
- Untyped deps (review.mjs, review-shared.mjs, journal.mjs, state.mjs, contract-*.mjs) carry `@ts-nocheck` → resolve to `any` at call sites; no casts needed for them.

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| SP-770 `.DONE` on main (`4c60aa78`); small modules + facade off allowlist | Preflight pass; proceed |
| `runWorker` JSDoc types `onHeartbeat`/`onWorkerPid` callbacks (`number`) | Callback bodies typecheck without casts |
| `runWorker` return type is an inferred union without `classification` on every member | Use `/** @type {any} */` cast per `engine-lanes.mjs` precedent |
| LOC 500 cap scans `src/batch/*.mjs` non-recursively (`loc-capstone.mjs:29-40`) | engine-lanes/ JSDoc growth out of policy scope |
| `PHASE23_GRANDFATHERED_OVER_500` is empty | No grandfather growth possible/needed |

## Completion Criteria

- [ ] Four review-* modules typed
- [ ] Allowlist shrunk
- [ ] Partial #283

## Blockers

_None yet._
