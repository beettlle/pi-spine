# Task: SP-111 — Orphan detect for PID-less ghost running

**Created:** 2026-06-05
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** searchATon 20260603T224829 class — running phase with no workerPid/enginePid bypasses orphan detect.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Extend `detectOrphanRunning` to flag ghost `running` when both PIDs absent but journal/state indicate stale engine session (scoped to post-resume window per SP-095). Add regression fixture and reconcile test.

**Source:** SP-106 audit Finding #1 (HIGH).

## Dependencies

- **None**

## File Scope

- `src/batch/orphan-detect.mjs`
- `src/batch/reconcile.mjs`
- `tests/batch/orphan-pidless-ghost.test.mjs` (new)
- `tests/fixtures/incidents/pidless-ghost-running.json` (new)

## Steps

### Step 1: Detection logic
- [ ] Third signal: phase running + no live PIDs + scoped journal stall
- [ ] Map to `engine_orphaned` or new kind
- [ ] Call `spine_review_step` (plan)

### Step 2: Reconcile integration + tests
- [ ] Reconcile returns non-running diagnosis for fixture
- [ ] Call `spine_review_step` (code)

### Step 3: Testing & Verification
- [ ] FULL suite + coverage gate

## Completion Criteria
- [ ] PID-less ghost fixture passes
- [ ] SP-095 scope rules preserved

## Git Commit Convention
- `feat(SP-111): orphan detect for PID-less ghost running`

## Do NOT
- Broaden orphan detect beyond scoped journal window

---

## Amendments (Added During Execution)
