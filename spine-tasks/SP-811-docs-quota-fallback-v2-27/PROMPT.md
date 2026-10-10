# Task: SP-811 — Docs: quota fallback policy + v2.27 runbook

**Created:** 2026-10-03
**Size:** S

## Review Level: 0 (None)

**Risk:** Docs only. Wrong policy text would undermine the #248 pin rule.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** v2.27.0 adds automatic provider failover (#329) and changes review honoring (#328), reviewer spawn handling (#332), `pending_lane_land` diagnosis (#330) and the glob engine (micromatch → picomatch). The release-operator skill still says "never escalate on quota/403" without distinguishing provider failover from escalation, and the runbook has no v2.27 section.

## Mission

Closes #329 — Document quota fallback as provider failover (not escalation) and the operator-visible v2.27.0 changes.

1. **`skills/spine-release-operator/SKILL.md`** (Hard rules, near the F7 / #248 model-pin rule, and Phase 4 "Model pin"):
   - Quota fallback (`agents.quotaFallbackProfile`) is **provider failover, not escalation**: it switches provider pool, not model strength; it is single-hop per batch, sticky, journaled, and never edits `.spine/spine-config.json`.
   - It is allowed mid-release. After it fires, the operator pastes the `Agent pin override: yes (…, auto quota fallback <pool> -> <profile>, batch <id>)` line shown by `spine status --diagnose` into the manifest.
   - The #248 rule stays: never escalate models on quota/403/launch storms. Keep the rule text; add the distinction next to it.
2. **`docs/adoption/operator-runbook.md`** — new subsection "v2.27.0 changes" (follow the style of the v2.26.0 subsection added by SP-803). Verify every identifier against `main` source before writing it:
   - Quota fallback: config key and `spine settings set agents.quotaFallbackProfile <profile>`; classifications `provider_quota_exhausted` / `provider_overloaded`; run-metrics `failureKind: "quota"`; journal events `worker.quota_exhausted`, `batch.quota_fallback_applied`, `task.quota_fallback_retry`, `batch.quota_fallback_exhausted`; state `resilience.quotaFallback`; env `SPINE_AGENT_PROFILE_OVERRIDE`; one hop per batch, one auto-retry per task, same lane worktree; transient overload never falls back; reset times are shown raw (provider local time); doctor same-pool warning; out of scope (reviewer/supervisor, backoff, reset scheduling).
   - #328: worker-launched test commands no longer attach to the live journal; the engine refuses foreign stub verdicts / out-of-folder artifacts; contract verification runs before a final-review honor.
   - #332: reviewer exit with no artifact is re-spawned once; reviewer output tail and log path are journaled (use the actual names from SP-814).
   - #330: `pending_lane_land` / salvage is not recommended while the engine is alive and a task is still running.
   - Glob matching now uses `picomatch` (same semantics; `micromatch` removed — audit high GHSA-vfj7-8cjw-p6xm).
   - Update the "interim workaround" guidance: with `agents.quotaFallbackProfile` set, manual `activeProfile` switching on quota failure is no longer needed.

## Dependencies

- **Task:** SP-809 (retry behaviour)
- **Task:** SP-810 (diagnose manifest line, doctor warning)
- **Task:** SP-813 (#328 engine behaviour)
- **Task:** SP-814 (#332 reviewer re-spawn names)
- **Task:** SP-815 (#330 diagnosis)
- **Task:** SP-817 (picomatch)
- **Task:** SP-818 (edits the runbook version-floor paragraph; land first to avoid a conflict)

## Context to Read First

- GitHub #329 (Proposed solution §9)
- `skills/spine-release-operator/SKILL.md` — Hard rules (F7 / #248), Phase 4 "Model pin"
- `docs/adoption/operator-runbook.md` — v2.26.0 subsection (SP-803) for style
- Source on `main`: `src/batch/quota-fallback.mjs`, `src/batch/engine-lanes/quota-fallback-state.mjs`, `src/batch/engine-lanes/quota-fallback-run.mjs`, `src/batch/provider-quota.mjs`, `src/doctor/quota-risk.mjs`, `src/batch/review-step-run.mjs`, `src/batch/diagnosis-pending-lane.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/spine-release-operator/SKILL.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/spine-release-operator/SKILL.md`, `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Read the v2.26.0 runbook subsection and the SKILL.md #248 rule
- [ ] Collect exact identifiers from `main` source (event names, keys, env vars, messages)
- [ ] Dependencies satisfied

### Step 1: Release-operator skill

- [ ] Provider failover vs escalation distinction next to the #248 rule
- [ ] Manifest override-line instruction

**Artifacts:**
- `skills/spine-release-operator/SKILL.md` (modified)

### Step 2: Runbook v2.27.0 subsection

- [ ] Quota fallback section
- [ ] #328, #332, #330, picomatch notes
- [ ] Interim workaround updated

**Artifacts:**
- `docs/adoption/operator-runbook.md` (modified)

### Step 3: Testing & Verification

- [ ] Every identifier in the new text matches `main` source (`rg` each one)
- [ ] Run test suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `skills/spine-release-operator/SKILL.md`
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `skills/spine-orchestrate-waves/SKILL.md` (quota recovery guidance) — note in Discoveries only

## Completion Criteria

- [ ] Skill distinguishes provider failover from escalation; #248 rule intact
- [ ] Runbook v2.27.0 subsection covers quota fallback, #328, #332, #330, picomatch
- [ ] All identifiers verified against source

## Git Commit Convention

- `docs(SP-811): quota fallback policy + v2.27.0 runbook (#329)`

## Do NOT

- Change source or tests
- Weaken or remove the #248 "never escalate on quota/403" rule
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- **2026-10-10 (operator, v2.27.0 wave 4):** Preflight flags `docs/adoption/operator-runbook.md` as pre-landed — SP-818 (`08d59a61`) changed only the `@earendil-works/pi-coding-agent` pin there. None of this packet's quota-fallback content is on `main` (no `quotaFallbackProfile` / quota fallback text in the runbook or `skills/spine-release-operator/SKILL.md`), so `fileScopeMustChange` stays as written.
