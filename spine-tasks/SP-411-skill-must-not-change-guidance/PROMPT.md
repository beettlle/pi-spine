# Task: SP-411 — Skill must-not-change guidance

**Created:** 2026-07-01
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only — create-spine-tasks SKILL contract echo.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Address **GitHub issue #63**: update `skills/create-spine-tasks/SKILL.md` File Scope / Contract sections to echo SP-410 parallel-only `fileScopeMustNotChange` rules and spine-tasks/** ban.

## Dependencies

- **Task:** SP-410 (contract template parallel semantics)

## Context to Read First

- GitHub issue #63
- SP-410 contract-template.md

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #63 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Read SP-410 template changes

### Step 2: Update SKILL.md

- [ ] Add must-not-change parallel-only note in File Scope section
- [ ] Cross-link contract-template.md
- [ ] Warn against spine-tasks/** in must-not-change when authoring packets

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/SKILL.md` — issue acceptance

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Acceptance criteria met

## Git Commit Convention

- `feat(SP-411): complete Step N — description`
- `fix(SP-411): description`
- `test(SP-411): description`

## Do NOT

- Duplicate entire contract-template content
- Change runbook (SP-412)

---

## Amendments (Added During Execution)
