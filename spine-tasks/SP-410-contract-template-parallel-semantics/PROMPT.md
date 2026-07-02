# Task: SP-410 — Contract template parallel semantics

**Created:** 2026-07-01
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only — contract-template must-not-change guidance.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Address **GitHub issue #63**: update `skills/create-spine-tasks/references/contract-template.md` — `fileScopeMustNotChange` is for **parallel lane** collision prevention; serialized same-lane tasks see cumulative branch diff until SP-414 lands.

## Dependencies

- **Task:** SP-398 (contract parse fix lands first — shared `contract-template.md`)

## Context to Read First

- GitHub issue #63
- stet batch `20260701T020526` journal examples

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/references/contract-template.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #63 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Read issue #63 and stet failure examples

### Step 2: Update contract-template.md

- [ ] State parallel-only semantics for `fileScopeMustNotChange`
- [ ] Explicit warning: never ban `spine-tasks/**` or current task folder
- [ ] Link planner overlap serialization warning to verify semantics
- [ ] Add good/bad examples (extension/** ok; spine-tasks/** bad)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/references/contract-template.md` — issue acceptance

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Acceptance criteria met

## Git Commit Convention

- `feat(SP-410): complete Step N — description`
- `fix(SP-410): description`
- `test(SP-410): description`

## Do NOT

- Change contract verify code (SP-414+)
- Edit unrelated skill files (SP-411)

---

## Amendments (Added During Execution)
