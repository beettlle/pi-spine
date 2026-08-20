# SP-709: spine wait --until failed matches terminal batch failure — Status

**Current Step:** Step 3: Documentation & Delivery
**Status:** In Progress
**Last Updated:** 2026-08-20
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

## Step 0: Preflight

**Status:** Completed

- [x] Confirm `reconciliationMatchesUntil` only exact-matches diagnosis today
- [x] List failure-class diagnoses that should satisfy `--until failed`

## Step 1: Implement phase-aware failed matching

**Status:** Completed

- [x] When `untilDiagnoses` contains `failed` and `result.phase === "failed"`, return true from `reconciliationMatchesUntil`
- [x] Keep explicit diagnosis tokens working (e.g. `worker_done_missing` in `--until` still matches directly)
- [x] Unit tests: mock reconcile snapshot with `phase: failed`, `diagnosis: worker_done_missing`, `--until failed` matches

## Step 2: Testing & Verification

**Status:** Completed

- [x] Run contract `testCommand` only — `npm run typecheck` clean; new test file 8/8 pass
- [x] Fix all failures from the scoped contract command — none; regression check `spine-wait-diagnosis.test.mjs` 11/11 pass

## Step 3: Documentation & Delivery

**Status:** In Progress

- Docs check: `skills/spine-orchestrate-waves/SKILL.md` and `docs/adoption/agent-orchestrated-waves.md` `--until` examples already include `failed`; the fix makes them work as written — no doc change needed.

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| | | | |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| 2026-08-20 | `reconciliationMatchesUntil` (src/cli/spine-wait.mjs) exact-matches `result.diagnosis` against `--until` tokens only; pseudo-diagnoses cover gate/limbo, not failure | `--until failed` never wakes when diagnosis is `worker_done_missing`/`worker_orphaned`/`engine_orphaned` (#252) |
| 2026-08-20 | `ReconciliationResult.phase` mirrors `batch.phase`; batch phase becomes `"failed"` on terminal failure (src/batch/state.mjs:119) | Phase-aware match can use `result.phase === "failed"` |
| 2026-08-20 | Blast radius of `reconciliationMatchesUntil`: single production caller `runSpineWait` (src/cli/wait.mjs:266) plus tests | LOW risk; additive early-return only |
| 2026-08-20 | Docs/skill `--until` lists already include `failed` (SKILL.md:57,101; agent-orchestrated-waves.md:66,157) | No doc list update needed; fix makes them work as written |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-19 | Task staged | PROMPT.md and STATUS.md created for v2.14.1 release |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
