# Task: SP-363 — Operator monitoring runbook

**Created:** 2026-06-29
**Size:** S

## Review Level: 0 (None)

**Assessment:** Documentation-only monitoring cookbook; no application code.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Fix **GitHub issue #47**: add operator monitoring cookbook section documenting when to use `watch`, `journal follow`, `wait`, dashboard, and engine logs.

**Required behavior:**

1. New subsection under runbook §3 Monitor with decision table (question → command)
2. Cross-link epic #43
3. Replace informal `spine journal tail` references with `journal follow`
4. Optional pointer in `docs/QUICK-REFERENCE.md`

**Closes:** [#47](https://github.com/beettlle/pi-spine/issues/47)

## Dependencies

- **Task:** SP-339 (#30 status JSON progress)
- **Task:** SP-360 (`spine watch`)
- **Task:** SP-361 (`spine journal follow`)
- **Task:** SP-362 (`spine wait`)

## Context to Read First

- GitHub issue #47
- Epic #43
- `docs/adoption/operator-runbook.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Verify SP-360–362 commands exist and match documented flags

### Step 1: Write monitoring cookbook

- [ ] Add §3 monitoring subsection with decision table
- [ ] Cross-link #43 and child issues
- [ ] Update QUICK-REFERENCE pointer if appropriate

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Close issue #47 (`gh issue close 47`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #47 documentation delivered
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-363): complete Step N — description`

## Do NOT

- Document commands that are not yet implemented (wait for deps)
