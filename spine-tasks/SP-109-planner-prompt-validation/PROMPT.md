# Task: SP-109 — Fail-loud PROMPT validation in planner and plan

**Created:** 2026-06-05
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** SP-075 fixed batch engine but planner/preflight/plan still accept invalid PROMPTs. Low blast radius, existing validatePrompt API.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Close SP-075 regression: `buildPlan()` and `spine plan` must reject invalid PROMPT packets with actionable errors (same as `engine-lanes.mjs`). Share validation helper across planner, preflight plan check, and `spine rules select`.

**Source:** SP-107 audit Finding #1 (HIGH).

## Dependencies

- **None**

## Context to Read First

- `spine-tasks/SP-107-audit-core-architecture/AUDIT-REPORT.md`
- `src/planner/index.mjs`, `src/tasks/packet/validate-prompt.mjs`, `src/batch/engine-lanes.mjs`

## File Scope

- `src/planner/index.mjs`
- `src/planner/scope.mjs`
- `bin/spine-plan.mjs`
- `bin/spine-preflight.mjs`
- `src/cli/rules.mjs`
- `tests/planner/prompt-validation.test.mjs` (new)

## Steps

### Step 0: Preflight
- [ ] Reproduce: invalid PROMPT still appears in `spine plan` output

### Step 1: Shared validation gate
- [ ] Add `assertValidTaskPacket(packet, taskId)` helper used by planner load path
- [ ] `buildPlan` throws/lists errors when `!packet.validation.ok`
- [ ] `spine plan` exit 1 with error list
- [ ] Call `spine_review_step` (plan)

### Step 2: Extend to preflight and rules CLI
- [ ] Preflight plan validation uses same helper
- [ ] `spine rules select` uses validatePrompt not parsePrompt only

### Step 3: Testing & Verification
- [ ] Unit tests: invalid heading, missing testing step, bad file scope → plan fails
- [ ] FULL suite + coverage gate

### Step 4: Documentation & Delivery
- [ ] Note in operator runbook troubleshooting if needed

## Completion Criteria
- [ ] Invalid PROMPT never appears in plan waves
- [ ] Tests green, coverage ≥77%

## Git Commit Convention
- `feat(SP-109): fail-loud PROMPT validation in planner`

## Do NOT
- Change PROMPT schema
- Weaken batch engine validation

---

## Amendments (Added During Execution)
