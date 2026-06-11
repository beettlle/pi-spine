# Task: SP-197 — SP-190 wedge incident fixture + E2E regression

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Lock in SP-190 wedge fix with reproducible stub fixture and optional batch replay.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Add a **regression fixture** for batch `20260611T222221` SP-190 wedge class:
- Worker writes `.DONE` then simulates hung child (stub env hook).
- Assert engine completes within post-done grace (SP-193), not 17+ minutes.

**Deliverables:**
1. `tests/fixtures/batch-state/sp-190-wedge-hang.json` or stub env `SPINE_WORKER_STUB_HANG_AFTER_DONE`
2. Integration test in `tests/batch/worker-post-done-grace.test.mjs` or dedicated file
3. Optional: document replay steps in `docs/adoption/operator-runbook.md` (attached-first § incident)

## Dependencies

- **Task:** SP-193
- **Task:** SP-195

## Context to Read First

**Tier 3:**
- `tests/batch/worker-post-done-grace.test.mjs` (from SP-193)
- `.spine/runtime/20260611T222221/journal/events.jsonl`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-worker-runner.mjs` (stub hang hook if needed)
- `tests/batch/worker-wedge-incident.test.mjs` (new)
- `tests/fixtures/batch-state/` (new fixture)
- `docs/adoption/operator-runbook.md` (optional short §)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | see File Scope |
| fileScopeMustNotChange | — |
| minLineCoverage | 77 |
| artifactsMustExist | — |

## Steps

### Step 0: Preflight

- [ ] Extract minimal reproduction from SP-190 incident timeline

### Step 1: Fixture + test

- [ ] Stub simulates hang-after-.DONE
- [ ] Assert task succeeds + journal shows post-done termination event

### Step 2: Testing & Verification

- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Operator runbook wedge playbook (optional)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] CI catches regression if post-done grace removed
- [ ] Fixture documents incident batch ID for operators

## Git Commit Convention

- `feat(SP-197): complete Step N — description`

## Do NOT

- Require real pi for CI gate
