# Task: SP-293 — Authoring approval checklist

**Created:** 2026-06-18
**Size:** S

## Review Level: 0 (None)

**Assessment:** Operator docs closing the spec-kit adoption loop; no code.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Add operator **pre-batch human gates** documentation: approve upstream spec/plan conversion before `spine batch start`. Tie spec-kit authoring gates (clarify, checklist, analyze) to pi-spine execution gates (validate, analyze, integrate).

**Deliverables:**
1. `docs/adoption/authoring-approval-checklist.md` — human checklist before batch start.
2. Link from `docs/adoption/operator-runbook.md` Path 1 step 3.
3. Link from `docs/adoption/upstream-execution-workflow.md`.
4. Distinguish **authoring gates** (human approve conversion) vs **execution gates** (`spine gate approve` after integrate).

**Checklist items:**
- Constitution/spec/plan reviewed and approved
- `spine tasks validate pending` passes
- `spine tasks analyze pending` passes (no blocking issues)
- `spine plan pending` reviewed for wave sizing
- `spine preflight` green

## Dependencies

- **Task:** SP-286 (Path 4 docs)
- **Task:** SP-287 (spec persistence models)
- **Task:** SP-291 (lean/full modes)
- **Task:** SP-292 (tasks analyze CLI)

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `docs/adoption/operator-runbook.md` — Path 1 authoring
- `docs/adoption/upstream-execution-workflow.md` — after SP-286
- `docs/adoption/spec-persistence.md` — after SP-287

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/authoring-approval-checklist.md`
- `docs/adoption/operator-runbook.md`
- `docs/adoption/upstream-execution-workflow.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | docs/adoption/authoring-approval-checklist.md |
| artifactsMustExist | docs/adoption/authoring-approval-checklist.md |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-286, SP-287, SP-291, SP-292 merged (or draft against plan)
- [ ] Read operator-runbook Path 1 step 3 placement

### Step 1: Authoring approval checklist doc

- [ ] Create authoring-approval-checklist.md with human gate items
- [ ] Authoring gates vs execution gates comparison table
- [ ] Mode-specific notes (lean skip vs full pipeline)

### Step 2: Cross-links

- [ ] operator-runbook.md: link before batch start
- [ ] upstream-execution-workflow.md: Further reading link

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Verify links resolve
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/authoring-approval-checklist.md` (new)
- `docs/adoption/operator-runbook.md`
- `docs/adoption/upstream-execution-workflow.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-293): complete Step N — description`
- `docs(SP-293): description`

## Do NOT

- Add automated enforcement of human approval in batch engine
- Duplicate full operator-runbook content

---

## Amendments (Added During Execution)
