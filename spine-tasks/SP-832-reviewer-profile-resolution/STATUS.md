# SP-832: Reviewer profile resolution and model-family guard — Status

**Current Step:** Done
**Status:** ✅ Complete
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `resolveReviewerModelPin`, `resolveReviewerThinkingPin`, `validateAgentProfilesConfig`, `buildReviewerPerTypePinsDoctorCheck` — record callers in Discoveries
- [x] Locate the preflight registration for the reviewer-pin check and record it

### Step 1: Model family + reviewer resolution
**Status:** ✅ Complete

- [x] `src/config/model-family.mjs` with `resolveModelFamily` / `isSameModelFamily`
- [x] `resolveEffectiveReviewer` with candidate order, missing-block warning, unknown-profile block, family guard

### Step 2: Schema + settings
**Status:** ✅ Complete

- [x] `agents.reviewerProfile` and `profiles.<name>.reviewerProfile` validated (unknown name and self-reference rejected)
- [x] `agents.reviewerProfile` settable via `spine settings set`

### Step 3: Doctor + preflight pairing report
**Status:** ✅ Complete

- [x] Doctor detail lists every worker pairing (active, quota fallback, escalate target)
- [x] Same-family pairing fails the doctor check and preflight

### Step 4: Tests
**Status:** ✅ Complete

- [x] Family table: `google/gemini-2.5-pro`, `google/gemini-4-argon`, `anthropic/claude-sonnet-5-5`, `zai/glm-5.3-flash`, `kimi-coding/k3`, `cursor/auto`, `cursor/gemini-3.1-pro`, `llama.cpp/qwen3.8-flash-next-iq3_s`, `inherit`, `null`
- [x] Precedence: PROMPT > worker profile `reviewerProfile` > `agents.reviewerProfile` > `agents.reviewer`, per review type
- [x] Missing `reviewer` block warns and falls back; unknown profile is blocked
- [x] Family guard skips a same-family candidate and blocks when none is cross-family
- [x] Schema rejects unknown / self-referencing `reviewerProfile`
- [x] Doctor detail and failure for a `gemini` worker paired with a `gemini` reviewer

### Step 5: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint`
- [x] Run Contract `testCommand` (ends with the stet review; triage per Mission note below)
- [x] Fix all failures

### Step 6: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-832-reviewer-profile-resolution/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `resolveReviewerModelPin`/`resolveReviewerThinkingPin` callers: `buildReviewerPiArgs` (src/batch/review-spawn.mjs), `spineAgentsUseInherit`, `formatReviewerEffectivePins` → doctor checks. GitNexus risk LOW; behavior preserved (shared `pickModelPin`/`pickThinkingPin` helpers) | Noted | src/config/agent-model-resolve.mjs |
| `validateAgentProfilesConfig` and `buildReviewerPerTypePinsDoctorCheck` have no upstream callers in graph beyond `runDoctorChecks`; risk LOW | Noted | src/config/spine-config-schema.mjs, src/doctor/agent-model-inherit.mjs |
| No separate preflight registration for "reviewer model pins": preflight's `doctor` check runs `runDoctorChecks` and fails on `issueCount`. Registered by making `runDoctorChecks` count a failed reviewer-pin check as an issue, so same-family pairings block `spine preflight` with no `spine-preflight-lib.mjs` change | Done | src/doctor/run-doctor-checks.mjs |
| `tests/config/settings-fields.test.mjs` pins the exact settable path list; added `agents.reviewerProfile` there (outside PROMPT file scope, required by new settings key) | Done | tests/config/settings-fields.test.mjs |
| `src/doctor/run-doctor-checks.mjs` edited (outside PROMPT file scope) to count the failed check as a doctor issue | Done | src/doctor/run-doctor-checks.mjs |
| Doctor pairing for non-active profiles uses `profiles[name].worker.model`, else the merged `agents.worker.model`; `agents.reviewer` fallback is the active profile's merged block, per spec | Noted | src/doctor/agent-model-inherit.mjs |
| Stet (9 findings) dismissed as false_positive: hunk-limited unused-import/dead-code claims (symbols are used), `cursor/gemini-3.1-pro` has a single slash, doctor `issueCount` counted once (checks.push, not record), settings-fields order is correct ('.' < 'P') | Dismissed | stet |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
| 2026-10-18 | Steps 0-4 implemented | Targeted tests pass |
| 2026-10-18 | Contract testCommand | lint, typecheck, listed tests pass; stet 0 findings; arch/doctor/config suites pass |
| 2026-10-18 | Contract re-run + stet triage | lint, typecheck, tests pass; stet 0 active findings |
| 2026-10-18 | Contract re-run (lint, typecheck, tests, stet 0 findings) | Pass; .DONE restored |
