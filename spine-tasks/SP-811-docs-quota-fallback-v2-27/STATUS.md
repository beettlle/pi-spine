# SP-811: Docs: quota fallback policy + v2.27 runbook — Status

**Current Step:** Step 4: Documentation & Delivery
**Status:** ✅ Complete
**Last Updated:** 2026-10-10
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Style + rule read
- [x] Identifiers collected
- [x] Dependencies satisfied

### Step 1: Release-operator skill
**Status:** ✅ Complete

- [x] Failover vs escalation
- [x] Manifest override line

### Step 2: Runbook v2.27.0 subsection
**Status:** ✅ Complete

- [x] Quota fallback
- [x] #328, #332, #330, picomatch
- [x] Interim workaround

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Identifiers verified
- [x] Test suite
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `skills/spine-orchestrate-waves/SKILL.md` contains **no** quota recovery guidance (no `quota` / `activeProfile` / `403` mentions) — no update needed there; quota failover policy lives in `spine-release-operator/SKILL.md` + runbook only. |
| 2 | The runbook had no pre-existing "interim workaround" text for quota failures — the workaround exists only in GitHub #329 ("Interim workaround" section). The new v2.27.0 subsection marks that procedure retired and keeps manual `agents.activeProfile` switching as the path when no fallback profile is configured. |
| 3 | SP-810 (diagnose manifest line + doctor same-pool warning) was pending on a sibling lane of this batch; its identifiers were taken from the SP-810 PROMPT contract (`Agent pin override: yes (<date>, auto quota fallback <pool> -> <profile>, batch <id>)`, same-pool advisory). All other identifiers verified against `src/` via `rg`: `worker.quota_exhausted`, `batch.quota_fallback_applied`, `task.quota_fallback_retry`, `batch.quota_fallback_exhausted`, `resilience.quotaFallback`, `SPINE_AGENT_PROFILE_OVERRIDE`, `provider_quota_exhausted`/`provider_overloaded`, `failureKind = "quota"`, `stub_verdict_in_live_batch`, `artifact_outside_task_folder`, `review.honor_rejected`, `review.spawn_retry`, `reviewerOutputLogRef`, `outputTail`, `pending_lane_land`, `picomatch ^4.0.7`. |
| 4 | Reviewer re-spawn cap is `REVIEW_SPAWN_MAX_ATTEMPTS = 2` (one re-spawn) in `src/batch/review-spawn-retry.mjs`; reviewer logs land at `.spine/runtime/<batchId>/lanes/lane-<n>/reviewer-output-<taskId>-<reviewType>.log` with a ≤ 2 KB redacted `outputTail`. |
| 5 | Full suite green: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test` → 2859 pass / 0 fail (~171s). |

## Blockers

_None._
