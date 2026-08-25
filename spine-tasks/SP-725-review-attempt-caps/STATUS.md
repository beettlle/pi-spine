# SP-725: Separate maxCodeReviewAttempts / maxPlanReviewAttempts — Status

**Current Step:** Complete
**Status:** 🟢 Complete
**Status:** 🟡 In Progress
**Last Updated:** 2026-08-25
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code changes.

---

## Step 1: Config schema + defaults

**Status:** ✅ Complete

- [x] Add maxCodeReviewAttempts and maxPlanReviewAttempts to REVIEW_DEFAULTS / settings-fields
- [x] Unset keys fall back to maxFinalAttempts (backward compatible)

## Step 2: Wire phase runners

**Status:** ✅ Complete

- [x] Use independent caps in code / final / plan review phases
- [x] Journal or diagnosis names exhausted phase

## Step 3: Testing & Verification

**Status:** ✅ Complete

- [x] Run contract `testCommand` only
- [x] Fix all failures from the scoped contract command (none — passed first run: typecheck clean, 16/16)

## Step 4: Documentation & Delivery

**Status:** ✅ Complete

- [x] Create `.DONE`

> Docs check: new keys (`review.maxCodeReviewAttempts` / `review.maxPlanReviewAttempts`) are not yet documented in `docs/` (grep confirms), and docs paths are outside File Scope — no doc edits required by "Check If Affected". Due-diligence beyond contract: 51/51 pass across engine-code-review, review-retry-reconcile, resume-lane-reviews, diagnosis-failure-class, contract-failed-terminal, settings-fields.

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| | | | |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| 2026-08-25 | `applyConfigDefaults` fills missing keys per-section from `REVIEW_DEFAULTS`; hardcoding numeric defaults for the new keys would clobber the `maxFinalAttempts` fallback for existing configs (e.g. `maxFinalAttempts: 5` + unset new key would wrongly cap at 3). New keys default to `null` = inherit `maxFinalAttempts`. | Design decision — preserves "no behavior change for existing configs" acceptance criterion of #265 |
| 2026-08-25 | `tests/config/settings-fields.test.mjs` deepEquals the exact `SETTINGS_FIELDS` path list; adding the two new paths breaks it unless updated. File is outside PROMPT File Scope but the update is logically required by the mission ("update settings-fields"). | Updated EXPECTED_PATHS in that test |
| 2026-08-25 | Diagnosis headline copy for `review_exhausted` lives in `src/batch/diagnosis-primary-failure.mjs` (outside File Scope); its ctx has no phase field. Journal route satisfies Step 2 checkbox ("Journal or diagnosis"): `review.exhausted` events carry `reviewType` (added `final`), phase attempt + cap fields. | Suggest follow-up task to plumb phase into headline ctx |
| 2026-08-25 | GitNexus impact: `runCodeReviewPhase` HIGH (2 direct callers, 3 processes); `runPlanReviewPhase` LOW; `REVIEW_DEFAULTS` LOW. Change is a pure fallback-chain resolution preserving behavior for existing configs. | Risk accepted — contained by `??` chain |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-25 | Task staged | PROMPT.md and STATUS.md created for v2.16.0 release |
| 2026-08-25 | Step 3 complete | Contract command passed first run: `npm run typecheck` clean + 16/16 (config-defaults-v2, final-verdict). Extra due-diligence: 51/51 across 6 affected suites. |
| 2026-08-25 | Step 4 complete | Docs not affected (new keys undocumented; docs out of scope). `.DONE` created. | `review.mjs`: code/plan phases resolve `maxCodeReviewAttempts`/`maxPlanReviewAttempts` ?? `maxFinalAttempts` ?? default(3); final-phase `review.exhausted` now carries `reviewType: "final"` (code/plan already did). 2 new tests in `final-verdict.test.mjs` (asymmetric code=1/final=5; fallback inherit). 11/11 pass. |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
