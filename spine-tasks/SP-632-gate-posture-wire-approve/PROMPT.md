# Task: SP-632 — Wire posture evaluator into approve path

**Created:** 2026-07-12
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Security-sensitive wiring into approve/land-loop; keep locked defaults.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 2, Reversibility: 1

## Mission

Closes #123 — Wire `evaluateGatePosture` into integrate approve / land-loop so eligible categories may auto-approve when config allows. Journal `decidedBy: auto` vs `human`. **Hard rule:** default integrate remains locked; destroy/auth never auto; do not bypass `validateSequenceAutoApproveGate` release/real-pi fail-closed rules.

**Source:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../docs/PRD-v2.5.0-gate-maturity-handoff.md) §6 FR-REL250-10

## Dependencies

- **Task:** SP-628 (evaluator)
- **Task:** SP-630 (category stamp)
- **Task:** SP-631 (streak)

## Context to Read First

- `src/batch/gate.mjs`
- `src/batch/sequence-wait.mjs`
- `src/doctor/sequence-safety.mjs`
- `src/batch/gate-posture-evaluate.mjs`
- GitHub [#123](https://github.com/beettlle/pi-spine/issues/123)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/gate.mjs`
- `src/batch/sequence-wait.mjs`
- `tests/batch/gate-posture-wire-approve.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/gate-posture-wire-approve.test.mjs` |
| fileScopeMustChange | `src/batch/gate.mjs`, `tests/batch/gate-posture-wire-approve.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Wire evaluator + safety tests

- [ ] Call evaluator before/during approve when category/config present
- [ ] Auto path journals decidedBy auto; locked never auto
- [ ] Tests: default locked, opted-in auto, release/safety coexistence

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

- [ ] Postures wired with locked defaults
- [ ] Closes #123

## Do NOT

- Default-enable auto-approve for integrate
- Bypass sequence-safety for release/real-pi
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-632): wire gate posture evaluator into approve`

