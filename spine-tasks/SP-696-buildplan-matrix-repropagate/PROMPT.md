# Task: SP-696 — Supersede #226 (docs/verify; no planner virtual rows)

**Created:** 2026-08-03
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Operator option A (2026-08-06): do **not** re-propagate `matrix` through `buildPlan`. SP-697/SP-698 deliver first-class row scheduling at run time under the parent task ID. Plan-time virtual `SP-X[rowId]` IDs recreate `task_not_found` (empirical on batch `20260806T184913`). Close #226 as superseded by #228.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Mission

**Partial / supersede path for #226** — Document and verify that runtime first-class matrix row scheduling (#228 / SP-697+SP-698) is the supported design. Keep `buildPlan` parent-only (no virtual row plan IDs). Update runbook wording so #226 is closed as superseded, not deferred pending planner propagation.

**Hard requirement:** Do **not** copy `matrix` / `matrixColumns` into `buildPlan` `tasksById`. That change fails matrix E2E with `task_not_found` until a future engine redesign consumes virtual plan IDs end-to-end (out of scope).

## Dependencies

- **Task:** SP-698 (first-class row schedule + aggregation + runbook §2.4 parent-only plan shape)

## Context to Read First

- `docs/adoption/operator-runbook.md` §2.4 — planner packing caveat
- `src/planner/index.mjs` — confirm matrix fields still omitted from `tasksById`
- Lane escalation STATUS notes from batch `20260806T184913` (block: propagation recreates `task_not_found`)
- GitHub #226, #228
- Manifest: `spine-tasks/_authoring/release-v2.12.3/manifest.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `spine-tasks/_authoring/release-v2.12.3/manifest.md`
- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && rg -n "does \\*\\*not\\*\\* expand" docs/adoption/operator-runbook.md && ! rg -n "matrixColumns|\\bmatrix\\b" src/planner/index.mjs` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-698 `.DONE`
- [ ] Confirm `buildPlan` still omits matrix fields (intentional)
- [ ] Confirm empirical block: planner propagation → `task_not_found` under current engine

### Step 1: Docs — supersede #226

- [ ] Update runbook §2.4 planner packing caveat: #226 closed as superseded by #228; no SP-696 planner re-propagation
- [ ] Update release manifest + CONTEXT Phase 79 for option A

### Step 2: Testing & Verification

- [ ] Contract `testCommand` green (runbook wording + planner still omits matrix)
- [ ] Do **not** change `src/planner/index.mjs`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`
- [ ] Operator closes GitHub #226 as superseded by #228

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — #226 superseded wording in §2.4

**Check If Affected:**
- `spine-tasks/_authoring/release-v2.12.3/manifest.md`
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] Runbook states parent-only `buildPlan` and #226 superseded by #228
- [ ] No planner matrix propagation shipped
- [ ] `.DONE` created
- [ ] #226 closable as superseded

## Do NOT

- Propagate `matrix` / `matrixColumns` through `buildPlan`
- Clear or rewrite SP-689 `.DONE` history
- Implement engine virtual-ID consumption (option B)
- Implement #229–#232
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `docs(SP-696): supersede #226 — parent-only buildPlan; runtime rows via #228`

## Amendments

- **2026-08-06 (pre-landed shared scope):** SP-695 already changed `docs/adoption/operator-runbook.md` after the original packet was authored. Original amendment dropped runbook from `fileScopeMustChange` for planner delivery.
- **2026-08-06 (operator option A):** Rewrite mission from planner re-propagation to docs/verify supersede. File Scope is docs + release authoring only. Empirical block from batch `20260806T184913` / commit `5de7ed89`.
