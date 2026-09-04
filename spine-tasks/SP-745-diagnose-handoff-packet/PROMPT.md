# Task: SP-745 — Diagnose handoff packet background + assessmentReason

**Created:** 2026-09-04
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Additive diagnose fields + human CLI layout; backward compatible; touches diagnosis hot path.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #278 — Extend diagnose handoff packet with additive `background: string[]` and `assessmentReason: string` beside existing `headline` / `suggestedCommand`. Surface Situation / Background / Assessment / Recommendation in `spine status --diagnose` human output without renaming public API fields to SBAR. Keep `diagnosis`, `headline`, `suggestedCommand`, `alternatives[]` unchanged for consumers.

## Dependencies

- **None**

## Context to Read First

- GitHub #278 — diagnose handoff packet brief
- `src/batch/diagnosis.mjs` — `buildDiagnosisOutput`
- `bin/spine-status.mjs` — human `--diagnose` printer
- `src/batch/status-json.mjs` — JSON diagnose path
- Related: #43, #212; consumers SP-746 / #279

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis.mjs`
- `bin/spine-status.mjs`
- `src/batch/status-json.mjs`
- `tests/batch/diagnosis.test.mjs`
- `tests/batch/diagnosis-failure-class.test.mjs`
- `tests/batch/diagnosis-headline-honesty.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/diagnosis.test.mjs tests/batch/diagnosis-failure-class.test.mjs tests/batch/diagnosis-headline-honesty.test.mjs tests/batch/diagnosis-launch-failed.test.mjs tests/batch/diagnosis-orphan-taxonomy.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis.mjs`, `bin/spine-status.mjs` |

## Steps

### Step 0: Preflight

- [ ] Map `buildDiagnosisOutput` return shape and callers
- [ ] Map human `--diagnose` and `--json` diagnose surfaces

### Step 1: Additive fields on diagnose output

- [ ] Add `background: string[]` — short decision-relevant facts (batchId, phase, journal hints, tried/alternative commands)
- [ ] Add `assessmentReason: string` — why this diagnosis enum, not just the label
- [ ] Preserve existing fields unchanged (backward compatible)

### Step 2: Human CLI + tests

- [ ] Print four roles in order: Situation=`headline`, Background bullets, Assessment=`diagnosis`+`assessmentReason`, Recommendation=`suggestedCommand`
- [ ] Ensure `--json` includes the new fields
- [ ] Unit tests for at least `needs_retry`, `engine_orphaned` (or `worker_orphaned` / current orphan taxonomy), `needs_integrate`

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures
- [ ] `rg` old diagnose field assumptions in `tests/` if Contract tests miss a caller

### Step 4: Documentation & Delivery

- [ ] No runbook required for this task (SP-743 owns handoff quality bar docs)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- (none — code deliverable; handoff vocabulary docs are SP-743)

**Check If Affected:**

- `docs/adoption/operator-runbook.md` — only if diagnose CLI help text is documented elsewhere; prefer STATUS note over editing shared runbook (owned by SP-743)

## Completion Criteria

- [ ] `--json` diagnose path includes `background` and `assessmentReason`
- [ ] Human `--diagnose` shows all four roles
- [ ] Consumers ignoring unknown fields keep working
- [ ] Tests cover at least three diagnoses above
- [ ] Closes #278
- [ ] `.DONE` created

## Do NOT

- Rename public fields to `situation` / `background` / `assessment` / `recommendation`
- Implement issue-draft/handoff markdown SBAR sections (SP-746)
- Change gate approve synthesis (#280)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `feat(SP-745): diagnose background and assessmentReason (#278)`
