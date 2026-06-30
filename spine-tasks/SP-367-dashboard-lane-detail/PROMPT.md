# Task: SP-367 — Dashboard lane detail panel

**Created:** 2026-06-29
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Dashboard snapshot + UI for per-lane journal tail and log lines; NFR-OBS-04 compliant.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix **GitHub issue #51**: add dashboard lane drill-down showing last journal events and log tail per lane.

**Required behavior:**

1. Lane expand or side panel: last 5 journal events, last 10 log lines
2. Data from `buildDashboardSnapshot` — no new reconcile path
3. Optional journal panel lane filter
4. UI contract tests updated

**Closes:** [#51](https://github.com/beettlle/pi-spine/issues/51)

## Dependencies

- **Task:** SP-364 (progress_snapshot enriches journal tail)
- **Task:** SP-365 (live log tail source)

## Context to Read First

- GitHub issue #51
- `src/dashboard/snapshot.mjs`, `src/dashboard/view.mjs`, `src/dashboard/public/dashboard.js`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- `src/dashboard/public/dashboard.js`
- `src/dashboard/public/dashboard.css`
- `src/dashboard/public/index.html`
- `tests/dashboard/ui-contract.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ui-contract.test.mjs` |
| fileScopeMustChange | `src/dashboard/snapshot.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/dashboard/ui-contract.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Audit snapshot lane model and journal tail builder

### Step 1: Snapshot lane detail fields

- [ ] Add per-lane recent events and log tail to snapshot builder
- [ ] View model helpers in `view.mjs`

### Step 2: Dashboard UI

- [ ] Lane detail panel in HTML/JS/CSS
- [ ] Optional journal lane filter

### Step 3: Tests

- [ ] Extend `tests/dashboard/ui-contract.test.mjs`

### Step 4: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 5: Documentation & Delivery

- [ ] Close issue #51 (`gh issue close 51`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #51 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-367): complete Step N — description`

## Do NOT

- Add a second reconcile implementation
- Block dashboard on missing live logs (graceful empty state)
