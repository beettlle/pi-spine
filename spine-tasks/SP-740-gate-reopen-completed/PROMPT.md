# Task: SP-740 — Gate reopen for completed phase + runbook §5.2

**Created:** 2026-08-30
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Completed-phase batches wedged after orch tip drift; resume --force refused; runbook wrong.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Closes #275 — After `stale_revision` / gate record removed, allow re-open + re-approve for `phase=completed` batches (e.g. `spine gate reopen` or `resume --force` routing through `openIntegrateGateAfterBatchComplete`). Align `spine integrate` blocker text with `spine gate status` when no gate record exists. Fix operator-runbook §5.2 so it does not recommend a refused `resume --force` path.

## Dependencies

- **Task:** SP-739

## Context to Read First

- GitHub #275 — §5.2 dead-end: resume refuses phase=completed
- `src/batch/resume-multi-validate.mjs` — resumable phases
- `src/batch/gate.mjs` — `openIntegrateGateAfterBatchComplete`
- `docs/adoption/operator-runbook.md` §5.2
- Parent: SP-739 — salvage gate-open shares gate.mjs

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume-multi-validate.mjs`
- `src/batch/gate.mjs`
- `src/batch/resume.mjs`
- `bin/spine-gate.mjs`
- `tests/batch/resume-gate-open.test.mjs`
- `tests/batch/gate-target-revision-validate.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/resume-gate-open.test.mjs tests/batch/gate-target-revision-validate.test.mjs tests/batch/gate.test.mjs tests/batch/detached-resume-gate.test.mjs` |
| fileScopeMustChange | `src/batch/resume-multi-validate.mjs`, `docs/adoption/operator-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-739 `.DONE` on main
- [ ] Map stale_revision → delete gate → resume refuse completed

### Step 1: Re-open path for completed

- [ ] Allow force-resume or dedicated `spine gate reopen` for completed + missing/stale gate
- [ ] Re-pin targetRevision to current orch tip and re-collect evidence
- [ ] Make integrate / gate status messages agree when gate absent

### Step 2: Runbook §5.2 + tests

- [ ] Rewrite §5.2 recovery steps to the working path
- [ ] Regression: completed + no gate → reopen succeeds

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] `docs/adoption/operator-runbook.md` — §5.2 stale-gate recovery
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — §5.2 stale-gate recovery

## Completion Criteria

- [ ] Completed-phase batches can re-open gate after tip drift
- [ ] integrate vs gate status messages consistent when no gate
- [ ] Runbook §5.2 corrected
- [ ] Closes #275
- [ ] `.DONE` created

## Do NOT

- Change salvage-only no-gate path beyond shared helpers (owned by SP-739)
- Weaken targetRevision fail-closed for approve/integrate when gate exists
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-740): reopen integrate gate for completed phase (#275)`
