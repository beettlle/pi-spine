# SP-825: Docs — reviewer isolation and re-review recovery — Status

**Current Step:** Step 3: Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-15
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Final names recorded from merged code (see Discoveries 1–7)
- [x] Dependencies satisfied (SP-819/820/821/822 landed on `main` via batch 20261014T223221-7ba1, commit 487b8567)

### Step 1: Operator runbook
**Status:** ✅ Complete

- [x] Agent model pins (§~548: reviewer `pi -ne` default, `loadUserExtensions` opt-out incl. per-profile)
- [x] Post-DONE review failure section (§~1547 rewritten; diagnosis-table row §~907 and cross-link §~1535 updated; anchor retitled)
- [x] Provider errors subsection (§~1983: reason meaning, `review.failed` `providerMessage`/`httpStatus`, reviewer output log, doctor hooks check, pi-headroom sentence)

### Step 2: Release operator skill
**Status:** ✅ Complete

- [x] Phase 4 paragraph (after Model pin: `pi -ne` default v2.27.1 #334, overrides only when `loadUserExtensions` true, re-review not salvage)

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Doc-referencing tests only
- [ ] Commands verified
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Settings key: `agents.reviewer.loadUserExtensions` (boolean, `src/config/settings-fields.mjs:90`); schema-validated on base `agents.reviewer` and per-profile `agents.profiles.<name>.reviewer`. Unset/`false` → reviewer spawns `pi -ne`; `true` → loads user extensions. Live check: `spine settings show agents.reviewer.loadUserExtensions` → `(not set)`, exit 0. Workers unchanged (already `-ne` via `shouldWorkerUsePiNoExtensions`). |
| 2 | Exit reasons: 9 strings in `REVIEW_INFRASTRUCTURE_EXIT_REASONS` (`src/batch/diagnosis-review-infra.mjs`): `plan|code|final_review_{spawn_failed,timeout,provider_error}`. Producer mapping at `review-poll.mjs:332-335` (`${reviewType}_review_timeout` / `_provider_error` / `_spawn_failed`). |
| 3 | Doctor check (SP-822): label **"pi extensions rewriting reviewer context"** (`pi-extension-hooks.mjs:295`); advisory-only (`ok: true, warning: true`), never hard-fails; warns only when `loadUserExtensions === true`; scans for `context`, `context_with_system`, `before_provider_request` hook registrations; `suggestedCommand: spine settings set agents.reviewer.loadUserExtensions false`. |
| 4 | Provider message (SP-820): `review.failed` payload gains `reason: review_provider_error` + `providerMessage` (+ `httpStatus` when present) — `providerErrorFields`, `src/batch/reviewer-provider-error.mjs:124-137`. Full reviewer output log: `.spine/runtime/<batchId>/lanes/lane-<n>/reviewer-output-<taskId>-<reviewType>.log` (`reviewer-output.mjs:37-47`). |
| 5 | Re-review path (SP-821): post-DONE review-infra failures diagnose `needs_retry` (SP-762's `pending_lane_land` mapping reversed); `spine batch retry <taskId>` re-runs only the review (`runWorker` short-circuits on lane `.DONE`; `review.resumed` journaled), then `spine batch resume`. `reconcile-diagnosis.mjs:228-236` comment confirms the mapping. |
| 6 | #331 caveat (packet): a retried post-hoc plan review can still reject finished work — re-review is not a rubber stamp. |
| 7 | v2.27.0 incident (SP-819 PROMPT): third-party `pi-headroom` extension rewrote reviewer context through a `context` hook, dropped `toolCall.thoughtSignature`, and made every Gemini review fail with HTTP 400. |
| 8 | Anchor survey: the old heading `Salvage → complete land loop after post-DONE plan-review spawn failure (#291, #292)` is referenced only inside `operator-runbook.md` (lines 907 and 1535) — safe to retitle with both in-file links updated. Line 907 (diagnosis table) also recommends salvage-first for post-DONE review spawn failures; updated in the same pass (completion criterion 2). |

## Blockers

_None._
