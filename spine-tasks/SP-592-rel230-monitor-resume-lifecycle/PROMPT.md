# Task: SP-592 — Monitor resume and lifecycle LOC

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Borderline modules — split only if still >500 LOC and grandfathered after prior waves.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Verify `resume.mjs` (506 LOC) and `lifecycle.mjs` (498 LOC) are ≤500 after prior splits. Split only if still listed in `PHASE23_GRANDFATHERED_OVER_500` and above 500 LOC. Update `bin/spine-cli/verify.mjs` to remove entries when compliant.

**Closes:** partial #117

## Dependencies

- **Task:** SP-590

## Context to Read First

- [`spine-tasks/_explore/batch-module-split-v23/findings.md`](../_explore/batch-module-split-v23/findings.md)
- [`bin/spine-cli/verify.mjs`](../../bin/spine-cli/verify.mjs)

## File Scope

- `src/batch/resume.mjs`
- `src/batch/lifecycle.mjs`
- `bin/spine-cli/verify.mjs`
- `tests/batch/resume-orphan-recovery.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/resume-orphan-recovery.test.mjs` |
| fileScopeMustChange | `bin/spine-cli/verify.mjs` |

## Steps

### Step 0: Preflight

- [ ] Run `wc -l src/batch/resume.mjs src/batch/lifecycle.mjs`
- [ ] Confirm SP-590 complete

### Step 1: Verify or split

- [ ] If ≤500 LOC: remove from `PHASE23_GRANDFATHERED_OVER_500` only
- [ ] If >500: extract helpers into new module(s) ≤500 LOC each; re-export

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/resume-orphan-recovery.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Record LOC outcome in STATUS.md
- [ ] Create `.DONE`

## Completion Criteria

- [ ] resume.mjs and lifecycle.mjs ≤500 or split with re-exports
- [ ] Grandfather entries removed when compliant

## Git Commit Convention

- `refactor(SP-592): verify resume/lifecycle LOC policy`

## Do NOT

- Split if already ≤500 LOC
- Change runtime behavior
