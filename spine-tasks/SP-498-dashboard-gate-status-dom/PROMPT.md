# Task: SP-498 — Dashboard gate status safe DOM

**Created:** 2026-07-05
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Localized dashboard UI fix replacing `innerHTML` with safe DOM construction. Single render path; XSS hardening with no API changes.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 1, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-498-dashboard-gate-status-dom/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Replace the `innerHTML` assignment for gate status rendering in `src/dashboard/public/dashboard.js` (~line 434) with `textContent` and explicit DOM node construction. Gate status values must not be interpolated into HTML strings.

**Closes:** [#181](https://github.com/beettlle/pi-spine/issues/181)

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `spine-tasks/CONTEXT.md`

**Tier 3 (load only if needed):**
- `src/dashboard/public/dashboard.js` — `renderGateAffordancePanel` gate status block
- `tests/dashboard/ui-contract.test.mjs` — dashboard UI contract tests

## Environment

- **Workspace:** `src/dashboard/public/`
- **Services required:** None

## File Scope

- `src/dashboard/public/dashboard.js`
- `tests/dashboard/ui-contract.test.mjs`
- `tests/dashboard/snapshot.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ && npm run coverage:check` |
| fileScopeMustChange | `src/dashboard/public/dashboard.js` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Read `renderGateAffordancePanel` in `dashboard.js` and locate the `innerHTML` gate status line
- [ ] Dependencies satisfied

### Step 1: Replace innerHTML with safe DOM construction

- [ ] Build gate status UI with `document.createElement`, `textContent`, and `classList` — no HTML string interpolation for dynamic values
- [ ] Preserve visual structure: status badge span with `gate-status` + status class, separator ` · `, and kind label (default `integrate`)
- [ ] Confirm no remaining `innerHTML` for gate status in this render path
- [ ] Run targeted tests: `npm test -- tests/dashboard/ui-contract.test.mjs`

**Artifacts:**
- `src/dashboard/public/dashboard.js` (modified)

### Step 2: Add regression test coverage

- [ ] Add or extend dashboard test asserting gate status renders without `innerHTML` (static analysis or DOM fixture check)
- [ ] Verify approved/rejected/pending status classes still apply correctly
- [ ] Run targeted tests: `npm test -- tests/dashboard/`

**Artifacts:**
- `tests/dashboard/ui-contract.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #181: `gh issue close 181 --comment "Gate status uses safe DOM construction — SP-498"`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — note XSS hardening if discoveries warrant

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Gate status render path uses `textContent`/DOM APIs only (no `innerHTML` for dynamic gate data)
- [ ] Existing gate status styling and labels preserved

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `fix(SP-498): complete Step N — description`
- **Bug fixes:** `fix(SP-498): description`
- **Tests:** `test(SP-498): description`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Refactor unrelated dashboard code

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
