# Task: SP-718 — Salvage eligible after final-review spawn failure

**Created:** 2026-08-22
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Operator recovery regression from v2.14.0; diagnose copy fix.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #257 — When `doneInLane=true` and lane branch has commits ahead of base after final-review `spawnFailed`/no artifact, salvage must list commits and allow `--integrate`. Diagnose must map `review.failed` + `spawnFailed` to correct failure class (not "timed out / increase SPINE_REVIEW_TIMEOUT_MS").

## Dependencies

- **None**

## Context to Read First

- `src/batch/salvage.mjs` — eligibility predicates
- `src/batch/reconcile-diagnosis.mjs` — diagnose headlines
- `tests/batch/salvage-*.test.mjs`
- GitHub #257, closed #196

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/salvage.mjs`
- `src/batch/reconcile-diagnosis.mjs`
- `tests/batch/salvage-final-review-spawn-failed.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/salvage-final-review-spawn-failed.test.mjs` |
| fileScopeMustChange | `tests/batch/salvage-final-review-spawn-failed.test.mjs` |

## Steps

### Step 1: Salvage eligibility

- [ ] Treat `doneInLane=true` + non-empty `main..lane` log as salvageable when task status is `failed` after final-review spawn failure
- [ ] Dry-run lists commits; `--integrate` succeeds for fixture scenario

### Step 2: Diagnose copy

- [ ] Map `spawnFailed` / no-artifact to distinct headline (not timeout copy unless timeout fired)

### Step 3: Testing & Verification

- [ ] Regression test mirroring #257 journal timeline (stub acceptable)
- [ ] Run contract `testCommand` only

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — salvage after final-review failure

## Completion Criteria

- [ ] Salvage dry-run non-empty when lane commits exist + doneInLane
- [ ] Diagnose does not claim timeout for spawnFailed-only failures
- [ ] Closes #257

## Do NOT

- Change final-review spawn semantics
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-718): salvage lane work after final-review spawn failure (#257)`
