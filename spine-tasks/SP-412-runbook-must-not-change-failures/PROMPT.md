# Task: SP-412 — Runbook must-not-change failures

**Created:** 2026-07-01
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only — operator runbook contract failure symptom.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Address **GitHub issue #63**: add operator runbook entry for stet-style `contract.verified` failures involving `spine-tasks/**` or prior same-lane task paths in `fileScopeMustNotChange`.

## Dependencies

- **Task:** SP-410 (contract template parallel semantics)
- **Task:** SP-409 (stub delivery runbook lands first — shared `operator-runbook.md`)

## Context to Read First

- GitHub issue #63
- `docs/adoption/operator-runbook.md` contract / common failures

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #63 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Read issue #63 journal payload examples

### Step 2: Runbook common failures section

- [ ] Symptom: testCommand pass, fileScopeMustNotChange fail on spine-tasks paths
- [ ] Fix: remove spine-tasks/** from must-not-change
- [ ] Note serialized lane cumulative diff until scoped verify (SP-416)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — issue acceptance

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Acceptance criteria met

## Git Commit Convention

- `feat(SP-412): complete Step N — description`
- `fix(SP-412): description`
- `test(SP-412): description`

## Do NOT

- Implement validate warning (SP-413)

---

## Amendments (Added During Execution)
