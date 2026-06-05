# Task: SP-118 — Adoption docs and test script hygiene

**Created:** 2026-06-05
**Size:** M

## Review Level: 0 (None)

**Assessment:** Docs-only wave — CONTEXT stale, fixture README, stall grace drift, PR template, test scripts.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Close doc/command drift from SP-106/108 audits: mark SP-101–105 Done in CONTEXT, expand incident fixture README, unify stall grace docs, add npm run test:batch/test:core, refresh verification counts, PR template coverage checkbox, adoption tasks-root decision table.

**Source:** SP-106 #7–9, SP-108 F4–F9.

## Dependencies

- **None**

## File Scope

- `spine-tasks/CONTEXT.md`
- `tests/fixtures/incidents/README.md`
- `docs/adoption/operator-runbook.md`
- `docs/adoption/bootstrap-checklist.md`
- `.github/pull_request_template.md`
- `package.json`

## Steps

### Step 1: CONTEXT and fixtures
- [ ] Phase 19 SP-101–105 → Done; add Phase 20 audit summary
- [ ] Incident fixture README lists all 4 fixtures with test links

### Step 2: Adoption docs
- [ ] Stall grace: document template 30 vs code fallback 15 explicitly
- [ ] Tasks-root decision table (spine-tasks vs taskplane-tasks)
- [ ] Verification section: 559 tests

### Step 3: CI/scripts
- [ ] Add test:batch and test:core npm scripts
- [ ] PR template: coverage:check checkbox

## Completion Criteria
- [ ] No stale "Staged" for landed Phase 19 tasks
- [ ] Fixture README complete

## Git Commit Convention
- `docs(SP-118): adoption docs and test script hygiene`

## Do NOT
- Change product code

---

## Amendments (Added During Execution)
