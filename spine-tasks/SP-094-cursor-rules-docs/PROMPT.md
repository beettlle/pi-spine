# Task: SP-094 — Cursor rules discovery documentation

**Created:** 2026-06-04
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs only.
**Score:** 1/8

## Mission

Document auto-discovery (append standards, include taskplane-worker-cursor, manifest in git, micromatch). Update PRD, README, runbooks, create-spine-tasks skill; amend SP-073 PROMPT.

## Dependencies

- **Task:** SP-092
- **Task:** SP-093

## Context to Read First

- `spine-tasks/SP-092-cursor-rules-worker-integration/STATUS.md`
- `spine-tasks/SP-093-cursor-rules-cli-init/STATUS.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/design/cursor-rules-discovery.md`
- `docs/PRD.md`
- `docs/adoption/bootstrap-checklist.md`
- `docs/adoption/operator-runbook.md`
- `README.md`
- `skills/create-spine-tasks/SKILL.md`
- `spine-tasks/SP-073-fr-work-05-standards-wiring/PROMPT.md`

## Steps

### Step 0: Preflight

- [ ] SP-092 + SP-093 done

### Step 1: Design + operator docs

- [ ] `docs/design/cursor-rules-discovery.md` + README + runbooks

### Step 2: PRD + skill + SP-073 amendment

- [ ] FR-WORK-05 + skill + SP-073 amendment

### Step 3: Testing & Verification

- [ ] `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- All paths in File Scope (except amendment-only SP-073)

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Design doc matches shipped behavior
- [ ] Operator can follow docs without reading source
- [ ] `npm run typecheck` passes

## Git Commit Convention

- `feat(SP-094): complete Step N — description`

## Do NOT

- Runtime code changes

---

## Amendments (Added During Execution)
