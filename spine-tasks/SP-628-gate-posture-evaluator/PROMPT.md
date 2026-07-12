# Task: SP-628 — Pure posture evaluation cascade

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** New pure evaluator; security-sensitive but isolated.
**Score:** 3/8 — Blast radius: 0, Pattern novelty: 2, Security: 1, Reversibility: 1

## Mission

Partial #123 — Implement pure `evaluateGatePosture(input)` (name flexible) with 5-tier cascade: posture → never-auto-approve → alwaysBreakOn → immediate auto → autoApproveAfterN (using provided streak count). No filesystem I/O.

**Source:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../docs/PRD-v2.5.0-gate-maturity-handoff.md) §6 FR-REL250-06

## Dependencies

- **Task:** SP-627 (defaults)

## Context to Read First

- `src/batch/gate-posture-defaults.mjs`
- GitHub [#123](https://github.com/beettlle/pi-spine/issues/123)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/gate-posture-evaluate.mjs`
- `tests/batch/gate-posture-evaluate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/gate-posture-evaluate.test.mjs` |
| fileScopeMustChange | `src/batch/gate-posture-evaluate.mjs`, `tests/batch/gate-posture-evaluate.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Implement cascade + tests

- [ ] Implement 5-tier evaluation returning allow-auto vs require-manual with reason
- [ ] locked / destroy / auth never auto
- [ ] Exhaustive unit tests for each tier

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
- None

## Completion Criteria

- [ ] Pure evaluator covered by unit tests

## Do NOT

- Wire into approve path (SP-632)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-628): add pure gate posture evaluator`

