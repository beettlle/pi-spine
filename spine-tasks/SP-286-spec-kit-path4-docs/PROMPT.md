# Task: SP-286 — Path 4 spec-kit upstream docs

**Created:** 2026-06-18
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only adoption guide; no runtime or engine changes.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Add **Path 4 — spec-kit optional upstream** to the pi-spine adoption docs so operators can compose [GitHub spec-kit](https://github.com/github/spec-kit) for spec authoring with pi-spine for batch execution — without integrating the `specify` CLI or `.specify/` state into pi-spine.

**Deliverables:**
1. New Path 4 section in `docs/adoption/upstream-execution-workflow.md`: choose-your-path table row, decision-tree branch, artifact handoff map (`.specify/memory/constitution.md`, `specs/<feature>/spec.md|plan.md|tasks.md` → spine packets), conversion rules, coexistence table (`.spine/` vs `.specify/`), feature-branch handoff note, explicit "what not to do" (no auto-import, no concurrent `/speckit.implement` + `spine batch start`).
2. Optional one-row spec-kit column in `docs/PRD-v1.3-upstream-execution-bridge.md` §2.2 relationship table.
3. Cross-links from `README.md`, `docs/adoption/bootstrap-checklist.md`, `docs/adoption/operator-runbook.md`, `docs/QUICK-REFERENCE.md`.

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `docs/adoption/upstream-execution-workflow.md` — existing Path 1–3 patterns
- `docs/PRD-v1.3-upstream-execution-bridge.md` — §2.2 zero-pi relationship table
- `skills/create-spine-tasks/SKILL.md` — Step 0 explore; upstream composition note

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/upstream-execution-workflow.md`
- `docs/PRD-v1.3-upstream-execution-bridge.md`
- `README.md`
- `docs/adoption/bootstrap-checklist.md`
- `docs/adoption/operator-runbook.md`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | docs/adoption/upstream-execution-workflow.md |
| artifactsMustExist | docs/adoption/upstream-execution-workflow.md |

## Steps

### Step 0: Preflight

- [ ] Read existing Path 2 (zero-pi) structure and mirror tone/depth for Path 4
- [ ] Confirm no spec-kit runtime dependency is implied anywhere

### Step 1: Path 4 upstream workflow

- [ ] Add Path 4 section with steps: install spec-kit separately → `/speckit.constitution` → specify → clarify → plan → tasks → manual/skill conversion → `spine tasks validate` → batch
- [ ] Update choose-your-path table and decision tree
- [ ] Add artifact handoff map row for spec-kit artifacts
- [ ] Document coexistence: `.spine/` vs `.specify/`; feature-branch handoff during authoring
- [ ] "What not to do" list (no auto-import, no shared state, no parallel implement + batch)

### Step 2: Cross-links and PRD table

- [ ] Add spec-kit mention to README upstream section
- [ ] Bootstrap checklist and operator-runbook one-liner links
- [ ] QUICK-REFERENCE upstream pointer
- [ ] Optional PRD §2.2 row: spec-kit vs zero-pi vs spine-native

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Verify all internal links resolve
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/upstream-execution-workflow.md`
- `README.md`
- `docs/adoption/bootstrap-checklist.md`
- `docs/adoption/operator-runbook.md`
- `docs/QUICK-REFERENCE.md`

**Check If Affected:**
- `docs/PRD-v1.3-upstream-execution-bridge.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-286): complete Step N — description`
- `docs(SP-286): description`

## Do NOT

- Add `specify` CLI as pi-spine dependency
- Document auto-import of spec-kit `tasks.md`
- Create unsolicited standalone markdown outside listed file scope

---

## Amendments (Added During Execution)
