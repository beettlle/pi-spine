# SP-712: Doctor ETIMEDOUT on --list-models is advisory — Status

**Current Step:** Step 3: Documentation & Delivery
**Status:** In Progress
**Last Updated:** 2026-08-21
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

## Step 0: Preflight

**Status:** Complete

- [x] Confirm ETIMEDOUT currently maps to `ok: false` + `pi login` — confirmed: `checkModelProvider` catch-all in `src/doctor/run-doctor-checks.mjs` (~line 196) returns `ok:false, suggestedCommand:"pi login"` for any spawn error including ETIMEDOUT
- [x] Confirm preflight fails on any `!entry.ok` doctor row — confirmed: `src/config/spine-preflight-lib.mjs:193` filters `!entry.ok` into failed checks; `warning:true` + `ok:true` rows pass

## Step 1: Advisory ETIMEDOUT handling

**Status:** Complete

- [x] Detect `result.error?.code === "ETIMEDOUT"` (and err.code ETIMEDOUT in catch) — `isListModelsTimeout` helper covers both paths
- [x] Return `{ ok: true, warning: true, detail: "pi --list-models timed out after 30s …", suggestedCommand: "retry spine doctor" }` — no `pi login`
- [x] Genuine auth / no-models cases stay hard fail (`pi login`); non-timeout spawn errors unchanged
- [x] Unit test with mocked spawnSync timeout path — `tests/doctor/list-models-timeout.test.mjs` (7 tests, injectable spawn)
- [x] `runDoctorChecks` passes `warning` through `record()` for the model-provider row so the advisory renders ⚠️ without incrementing issueCount

## Step 2: Testing & Verification

**Status:** Complete

- [x] Ran contract `testCommand`: `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/doctor/list-models-timeout.test.mjs` — typecheck clean, 7/7 pass

## Step 3: Documentation & Delivery

**Status:** Complete

- [x] Checked `docs/adoption/operator-runbook.md` — not affected: its `pi login` guidance covers the inherit-provider auth probe (SP-460/#97, `buildInheritProviderAuthDoctorCheck`), not the "model provider configured" row; no ETIMEDOUT guidance exists to contradict. No doc edit needed (also outside File Scope).
- [x] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| | | | |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| | | |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-19 | Task staged | PROMPT.md and STATUS.md created for v2.14.1 release |
| 2026-08-20 | Prelanded amend | fileScopeMustChange → list-models-timeout.test.mjs only (SP-710 touched run-doctor-checks.mjs) |
| 2026-08-21 | Step 0 complete | Confirmed ETIMEDOUT→ok:false+pi login; preflight fails on any !entry.ok |
| 2026-08-21 | Plan review (Step 1) | spine_review_step returned skipped (real-pi session; engine reviews post-.DONE) |
| 2026-08-21 | Step 1 complete | checkModelProvider exported w/ injectable spawn; ETIMEDOUT advisory; commit df7894c4 |
| 2026-08-21 | Step 2 complete | Contract testCommand: typecheck clean, 7/7 tests pass |
| 2026-08-21 | Step 3 complete | Runbook checked (not affected — #97 auth-probe doc only); .DONE created |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
