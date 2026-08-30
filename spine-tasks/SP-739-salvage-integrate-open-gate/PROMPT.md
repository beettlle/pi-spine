# Task: SP-739 — salvage --integrate opens gate when none exists

**Created:** 2026-08-30
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Recovery path dead-ends on missing gate record; needs safe gate open + evidence for pre-merge failures.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Closes #274 — When `spine batch salvage --integrate` finds salvageable lane commits but no integrate gate record (batch failed before merge), open a fresh gate (or equivalent approved recovery path) using salvage inspection evidence instead of failing with "no gate record" / "approve evidence before merging".

## Dependencies

- **None**

## Context to Read First

- GitHub #274 — salvage dry-run OK, --integrate blocked: no gate record
- `src/batch/salvage-batch-integrate.mjs` — `integrateSalvageableLane`
- `src/batch/gate.mjs` — `openIntegrateGate`
- `tests/batch/batch-salvage-integrate.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/salvage-batch-integrate.mjs`
- `src/batch/gate.mjs`
- `tests/batch/batch-salvage-integrate.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-salvage-integrate.test.mjs tests/batch/batch-salvage-list.test.mjs tests/batch/engine-gate-open.test.mjs` |
| fileScopeMustChange | `src/batch/salvage-batch-integrate.mjs`, `tests/batch/batch-salvage-integrate.test.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Reproduce no-gate salvage integrate failure in unit fixture
- [ ] Read `openIntegrateGate` / evidence collection APIs

### Step 1: Open gate from salvage

- [ ] When salvageable and gate absent, open gate with salvage evidence + current orch tip pin
- [ ] Fail closed if lane is not salvageable / evidence insufficient
- [ ] Keep existing path when gate already open

### Step 2: Tests + runbook note

- [ ] Test: no gate + salvageable lane → gate opened or integrate proceeds after open
- [ ] Document recovery in operator-runbook salvage section (brief)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] `docs/adoption/operator-runbook.md` — salvage --integrate when no gate
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — salvage --integrate when no gate

## Completion Criteria

- [ ] salvage --integrate no longer dead-ends solely on missing gate record for salvageable lanes
- [ ] Tests cover no-gate salvage integrate
- [ ] Runbook mentions the path
- [ ] Closes #274
- [ ] `.DONE` created

## Do NOT

- Implement full gate reopen for stale_revision (#275) — that is SP-740
- Bypass evidence/approval posture when posture requires human approve
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-739): salvage integrate opens missing gate (#274)`
