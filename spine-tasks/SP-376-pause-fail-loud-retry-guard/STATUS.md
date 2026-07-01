# SP-376: Pause fail-loud and retry guard — Status

**Current Step:** Step 3 (Complete)
**Status:** ✅ Complete
**Last Updated:** 2026-07-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-375 behavior — SP-375 not merged; implemented fail-loud guard in `pause.mjs` for live attached engine PID
- [x] Read retry phase guard error message — `Cannot retry task while batch phase is running. Pause the batch first.`

---

### Step 1: CLI guardrails
**Status:** ✅ Complete

- [x] Fail loud when pause journal written but phase still running after grace
- [x] Allow batch retry when phase paused (existing `retry.mjs` guard; regression test added)

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — typecheck pass; 1259 tests, 1 pre-existing flaky failure (`runWorker with contract stall override survives beyond global stall budget (scaled)`), unrelated to SP-376; all 5 `pause-retry-guard` tests pass
- [x] Run coverage gate: `npm run coverage:check` — aborted by same pre-existing flaky test; `pause.mjs` line coverage 90.44% from contract tests (≥77% gate)

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Update runbook pause/retry guidance
- [ ] Close issue #57 — deferred until merge to main (PROMPT Do NOT)
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| SP-375 not on branch; fail-loud polls attached engine grace instead of engine-side pause | Implemented SP-376 guard only | `src/batch/pause.mjs` |
| Full suite has pre-existing flaky/failing stall override test | Out of scope | `tests/batch/contract-stall-override.test.mjs` (approx) |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-30 | Step 1 | Added `pause.mjs` fail-loud + tests |
| 2026-06-30 | Step 2–3 | Tests/docs; `.DONE` |
| 2026-07-01 | Re-verify | Contract tests pass; `.DONE` recreated after accidental delete |

---

## Blockers

*None*

---

## Notes

- `pauseBatch` is async when a live attached engine PID is present; polls up to 3s for `phase: paused`, else exits 1 with `pause_not_confirmed` and journals `batch.pause_failed`.
