# Task: SP-624 — Validate targetRevision on gate use

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Tightens integrate safety; touches check/approve path.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 1

## Mission

Closes #121 — When using an approved gate (approve-use / `checkIntegrateGate` / integrate), compare current orch tip (same helper as SP-623) to `gate.targetRevision`. On mismatch: fail closed, require re-open/re-approve (do not silently integrate).

**Source:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../docs/PRD-v2.5.0-gate-maturity-handoff.md) §6 FR-REL250-02

## Dependencies

- **Task:** SP-623 (persist helper + field must exist)

## Context to Read First

- `src/batch/gate.mjs` — `checkIntegrateGate`, `approveIntegrateGate`
- `src/batch/integrate.mjs` — integrate entry
- `spine-tasks/SP-623-gate-target-revision-persist/PROMPT.md`
- GitHub [#121](https://github.com/beettlle/pi-spine/issues/121)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/gate.mjs`
- `src/batch/gate-revision.mjs`
- `src/batch/integrate.mjs`
- `tests/batch/gate-target-revision-validate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/gate-target-revision-validate.test.mjs` |
| fileScopeMustChange | `src/batch/gate.mjs`, `tests/batch/gate-target-revision-validate.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Validate on check / integrate

- [ ] Compare current revision to `gate.targetRevision` before treating gate as usable
- [ ] On drift: return fail-closed GateBlocked (clear wording); do not integrate
- [ ] Cover match + mismatch in unit tests

### Step 2: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Must Update docs modified (if any)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-633

## Completion Criteria

- [ ] Stale revision blocks integrate
- [ ] Matching revision allows approved gate path
- [ ] Closes #121 acceptance for revision pinning

## Do NOT

- Implement blocker codes (SP-625–626) or postures (SP-627+)
- Weaken `SPINE_ALLOW_FORCE` semantics without tests
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-624): validate targetRevision on gate use`

