# Task: SP-336 — Dashboard heartbeat display fix

**Created:** 2026-06-28
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Dashboard double-formats `heartbeatDisplay` string — shows `launchings` instead of `launching`.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #27**: Heartbeat column shows `launchings` because `dashboard.js` runs pre-formatted `heartbeatDisplay` through `formatHeartbeat()` which appends `s`.

**Required behavior:**

1. Use `lane.heartbeatDisplay` directly when present; only format numeric `heartbeatAgeSeconds` as fallback.
2. Regression test in `tests/dashboard/ui-contract.test.mjs`.

**Closes:** [#27](https://github.com/beettlle/pi-spine/issues/27)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #27
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/dashboard/public/dashboard.js`
- `tests/dashboard/ui-contract.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ui-contract.test.mjs` |
| fileScopeMustChange | `src/dashboard/public/dashboard.js` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/dashboard/ui-contract.test.mjs` |

## Steps

### Step 0: Preflight: confirm double-format path

- [ ] Preflight: confirm double-format path

### Step 1: Fix dashboard.js heartbeat render

- [ ] Fix dashboard.js heartbeat render

### Step 2: UI contract test + delivery

- [ ] UI contract test + delivery

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #27 (`gh issue close 27`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #27 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-336): complete Step N — description`
- `fix(SP-336): description`
- `test(SP-336): description`

## Do NOT

- Expand scope beyond issue #27 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
