# Task: SP-709 — spine wait --until failed matches terminal batch failure

**Created:** 2026-08-19
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Wait-loop matching fix; LOW GitNexus blast radius on `diagnosisMatchesUntil`.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #252 — `spine wait --until failed` must wake when the batch has terminally failed even if reconcile **diagnosis** is `worker_done_missing`, `worker_orphaned`, or `engine_orphaned` (not the literal string `failed`). Prefer matching when `phase === "failed"` in `reconciliationMatchesUntil` before exact diagnosis match. Update skill/docs example `--until` lists if needed.

## Dependencies

- **None**

## Context to Read First

- `src/cli/spine-wait.mjs` — `reconciliationMatchesUntil`, `deriveWaitPseudoDiagnoses`
- `src/batch/diagnosis-worker-done-missing.mjs` — failure class
- `skills/spine-orchestrate-waves/SKILL.md` — wait recipe (read-only unless example stale)
- GitHub #252

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/cli/spine-wait.mjs`
- `tests/cli/spine-wait-failed-match.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/cli/spine-wait-failed-match.test.mjs` |
| fileScopeMustChange | `src/cli/spine-wait.mjs`, `tests/cli/spine-wait-failed-match.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm `reconciliationMatchesUntil` only exact-matches diagnosis today
- [ ] List failure-class diagnoses that should satisfy `--until failed`

### Step 1: Implement phase-aware failed matching

- [ ] When `untilDiagnoses` contains `failed` and `result.phase === "failed"`, return true from `reconciliationMatchesUntil`
- [ ] Keep explicit diagnosis tokens working (e.g. `worker_done_missing` in `--until` still matches directly)
- [ ] Unit tests: mock reconcile snapshot with `phase: failed`, `diagnosis: worker_done_missing`, `--until failed` matches

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `skills/spine-orchestrate-waves/SKILL.md` — update default `--until` example if it still omits failure-class diagnoses unnecessarily
- `docs/adoption/agent-orchestrated-waves.md` — same

## Completion Criteria

- [ ] `--until failed` wakes on terminal batch failure with `worker_done_missing`
- [ ] Scoped tests pass
- [ ] Closes #252

## Do NOT

- Remove explicit diagnosis matching for operators who list `worker_done_missing` directly
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-709): spine wait --until failed matches phase failed (#252)`
