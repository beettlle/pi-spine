# Task: SP-496 — state_drift recovery UX

**Created:** 2026-07-04
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Diagnosis suggestedCommand fix + doc alignment; localized to diagnosis/reconcile helpers and operator docs. Release-blocking for v1.6.0 wave recovery.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Fix operator recovery for `state_drift` during release batches ([#164](https://github.com/beettlle/pi-spine/issues/164)):

1. Replace invalid `spine batch retry --force` suggested command with `spine batch retry <taskId>` (include drifted task id when known).
2. Align operator runbook: when drift task is still `running`, document pause → retry → resume flow (reconcile with SP-315 orphan guidance).
3. Update `skills/spine-release-operator/SKILL.md` §4.4 — do not say "follow suggestedCommand" for state_drift until command is valid.

Overlap with SP-479 is acceptable; land this without SP-478 dependency so v1.6.0 can resume.

**Closes:** [#164](https://github.com/beettlle/pi-spine/issues/164) (Partial: [#168](https://github.com/beettlle/pi-spine/issues/168) docs-only remainder)

## Dependencies

- **None**

## Context to Read First

- GitHub issues #164, #168
- `src/batch/diagnosis.mjs` — `buildSuggestedCommand`
- `skills/spine-release-operator/SKILL.md` §4.4
- `docs/adoption/operator-runbook.md` — state_drift section
- `spine-tasks/SP-479-contract-cli-friction-fixes/PROMPT.md` — avoid duplicate scope where SP-479 lands later

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis.mjs`
- `skills/spine-release-operator/SKILL.md`
- `docs/adoption/operator-runbook.md`
- `tests/cli/spine-diagnosis-state-drift.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/spine-diagnosis-state-drift.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/diagnosis.mjs` |
| artifactsMustExist | `tests/cli/spine-diagnosis-state-drift.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issues #164 and #168
- [ ] Confirm current `state_drift` suggested command is invalid on main

### Step 1: Diagnosis fix

- [ ] Emit `spine batch retry <taskId>` for state_drift when drift task id is known
- [ ] Fallback: `spine batch pause` + `spine batch retry <taskId>` when task still running

### Step 2: Tests

- [ ] Add `tests/cli/spine-diagnosis-state-drift.test.mjs`
- [ ] Assert suggested command is valid CLI (no bare `retry --force`)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update operator runbook state_drift recovery tree
- [ ] Update release-operator skill §4.4
- [ ] Comment on GitHub #164; close or Partial #168
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`
- `skills/spine-release-operator/SKILL.md`

## Completion Criteria

- [ ] `spine status --diagnose` never suggests invalid `retry --force` for state_drift
- [ ] Release operator skill documents correct recovery
- [ ] Issue #164 closed

## Do NOT

- Block on SP-478/SP-479 dependency chain — land #164 fix standalone
- Expand into SP-484 review-crash scope
- Skip diagnosis regression test
- Commit without SP-496 prefix in commit message

---

**Closes:** [#164](https://github.com/beettlle/pi-spine/issues/164)
