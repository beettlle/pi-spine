# Task: SP-288 — Constitution init template

**Created:** 2026-06-18
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Small init wiring change; touches spine init constants and template config.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Add a project **constitution** template (adapted from spec-kit's constitution concept) that `spine init` copies to `docs/constitution.md` and lists in default `referenceDocs` — giving teams a single upstream principles artifact without spec-kit dependency.

**Deliverables:**
1. `templates/docs/constitution.md` — project name, guiding principles, non-negotiable rules scaffold.
2. Wire into `src/config/spine-init-constants.mjs`: `TEMPLATE_PATHS.constitution`, copy on init (skip if `docs/constitution.md` already exists).
3. Default `referenceDocs` in `templates/spine-config.json` includes `docs/constitution.md`.
4. Update `tests/spine-init.test.mjs` and `docs/adoption/bootstrap-checklist.md`.

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `src/config/spine-init-constants.mjs` — `TEMPLATE_PATHS`, init copy logic
- `templates/spine-config.json` — `referenceDocs` field
- `tests/spine-init.test.mjs` — existing init assertions

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/docs/constitution.md`
- `src/config/spine-init-constants.mjs`
- `templates/spine-config.json`
- `tests/spine-init.test.mjs`
- `docs/adoption/bootstrap-checklist.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | templates/docs/constitution.md, src/config/spine-init-constants.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | templates/docs/constitution.md |

## Steps

### Step 0: Preflight

- [ ] Read existing init template copy pattern (tasks CONTEXT, agents)
- [ ] Confirm `getTemplatePaths()` validation includes new template

### Step 1: Constitution template and init wiring

> **Plan-review checkpoint**

- [ ] Create `templates/docs/constitution.md` with editable scaffold (principles, testing, UX, performance)
- [ ] Add `TEMPLATE_PATHS.constitution` and copy to `docs/constitution.md` on init (no overwrite when exists)
- [ ] Set `referenceDocs: ["docs/constitution.md"]` in spine-config template

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Extend `tests/spine-init.test.mjs`: constitution file created; referenceDocs populated
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Bootstrap checklist: mention constitution scaffold
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/bootstrap-checklist.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-288): complete Step N — description`
- `test(SP-288): description`

## Do NOT

- Require constitution for batch start
- Overwrite existing `docs/constitution.md` on re-init without `--force`

---

## Amendments (Added During Execution)
