# Task: SP-489 — Dashboard failed task highlights

**Created:** 2026-07-03
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Single-module dashboard change adding CSS classes and status-based row formatting. No security surface. Existing test infrastructure covers dashboard contract tests.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-489-dashboard-failed-task-highlights/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Add visual distinction for failed tasks in the dashboard Lanes table. Currently operators must read each row's status text to identify failures. Add red highlighting for failed/terminal-failure tasks and an explicit "FAILED — {exitReason}" label in the status column so failures are immediately visible at a glance. Also add green styling for succeeded tasks and amber for running tasks.

**Closes:** [#133](https://github.com/beettlle/pi-spine/issues/133)

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `spine-tasks/CONTEXT.md`

**Tier 3 (load only if needed):**
- `src/dashboard/public/index.html` — dashboard HTML structure

## Environment

- **Workspace:** `src/dashboard/public/`
- **Services required:** None

## File Scope

- `src/dashboard/public/dashboard.css`
- `src/dashboard/public/dashboard.js`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm test -- tests/dashboard/ui-contract.test.mjs tests/dashboard/snapshot.test.mjs` |
| fileScopeMustChange | `src/dashboard/public/dashboard.css`, `src/dashboard/public/dashboard.js` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Add CSS status classes

- [ ] Add `.task-failed` class: red text or red background tint for failed/terminal-failure tasks
- [ ] Add `.task-succeeded` class: green text for succeeded/terminal-success tasks
- [ ] Add `.task-running` class: amber/yellow for running tasks
- [ ] Ensure color choices work in both light and dark contexts; do not rely on color alone (pair with text labels per accessibility)

**Artifacts:**
- `src/dashboard/public/dashboard.css` (modified)

### Step 2: Apply status classes and format status cell

- [ ] In the Lanes table row renderer in `dashboard.js`, apply the appropriate CSS class based on task status (`failed`/`terminal-failure` → `.task-failed`, `succeeded`/`terminal-success` → `.task-succeeded`, `running` → `.task-running`)
- [ ] Format the status cell for failed tasks to show `❌ FAILED — {exitReason}` (e.g., `❌ FAILED — contract_failed`)
- [ ] Format the status cell for succeeded tasks to show `✅ Done`
- [ ] Preserve existing status display for pending and other states

**Artifacts:**
- `src/dashboard/public/dashboard.js` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #133: `gh issue close 133 --comment "Dashboard failed task highlights added — SP-489"`

## Documentation Requirements

**Must Update:**
- None (dashboard visual change; no operator-facing docs required)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — mention red highlighting if dashboard section exists

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Failed tasks show red highlighting and `❌ FAILED — {exitReason}` in the Lanes table
- [ ] Succeeded tasks show green styling and `✅ Done`
- [ ] Running tasks show amber styling

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-489): complete Step N — description`
- **Bug fixes:** `fix(SP-489): description`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Change dashboard layout or structure beyond status highlighting

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
