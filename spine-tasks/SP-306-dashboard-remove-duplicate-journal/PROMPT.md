# Task: SP-306 — Remove duplicate dashboard journal panel

**Created:** 2026-06-18
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Operator-visible dashboard UI removal; low blast radius, single feature area.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-306-dashboard-remove-duplicate-journal/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Remove the redundant `#default-journal-section` ("Journal tail") from the dashboard default view. SP-234 added a duplicate journal list above active batch panels; the bottom `Journal (last 20)` panel already renders the same `vm.journal` data. Keep gate + diagnosis on the default view; single journal affordance at the bottom of `#active-panels`.

## Dependencies

- **None**

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `src/dashboard/public/index.html`
- `src/dashboard/public/dashboard.js`
- `tests/dashboard/ui-contract.test.mjs`
- `spine-tasks/SP-234-dashboard-journal-tail/PROMPT.md` — original duplicate panel (superseded by this UX fix)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/public/index.html`
- `src/dashboard/public/dashboard.js`
- `tests/dashboard/ui-contract.test.mjs`
- `docs/adoption/operator-runbook.md` (only if dashboard section still implies duplicate journal block)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/dashboard/public/index.html`, `src/dashboard/public/dashboard.js` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm duplicate: `renderDefaultStatusPanels` calls `renderDefaultJournalTail` while `renderSnapshot` also calls `renderJournal(vm.journal)` when `!vm.idle`
- [ ] Read `index.html` — locate `#default-journal-section` vs bottom `#journal-heading`

**Plan-review checkpoint**

### Step 1: Remove duplicate UI

- [ ] Delete `#default-journal-section` block from `index.html` (heading "Journal tail", list, deep link)
- [ ] Delete `renderDefaultJournalTail` function and FR-SHIP-07 phase-2 comment from `dashboard.js`
- [ ] Refactor `renderDefaultStatusPanels(vm)`: show `#default-status-panels` only when `vm.gateAffordance?.visible`; remove all `default-journal-*` DOM references

### Step 2: Testing & Verification

- [ ] Update `ui-contract.test.mjs`: remove assertions for `default-journal-section`, `default-journal-list`, `View full journal`; assert `journal-heading` / `journal-list` remain
- [ ] Rename/update test `"running batch view model exposes journal for default tail panel"` to reflect bottom panel only
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Clarify runbook dashboard section if it implies duplicate journal block (optional one line)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- Dashboard files in File Scope

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — §dashboard (lines ~773–774 already say journal is in active batch panels)

## Completion Criteria

- [ ] No "Journal tail" heading or `#default-journal-section` in dashboard HTML
- [ ] Active batch still shows journal in bottom `Journal (last 20)` panel
- [ ] Integrate gate panel on default view unchanged
- [ ] Tests and coverage gate passing
- [ ] `.DONE` created

## Git Commit Convention

- `fix(SP-306): complete Step N — description`
- `test(SP-306): description`

## Do NOT

- Change `snapshot.mjs`, `view.mjs`, or journal CLI/handoff
- Remove bottom `Journal (last 20)` panel
- Skip coverage gate

---

## Amendments (Added During Execution)
