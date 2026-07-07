# Task: SP-517 — Dashboard wave completed under drift

**Created:** 2026-07-07
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Dashboard display fix under drift/orphan diagnosis.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix [#186](https://github.com/beettlle/pi-spine/issues/186): wave panel must not show `[completed]` when diagnosis is `state_drift` or `engine_orphaned` despite terminal-success artifacts on disk.

**Closes:** [#186](https://github.com/beettlle/pi-spine/issues/186)

## Dependencies

- SP-512

## File Scope

- `src/dashboard/snapshot-waves.mjs`
- `src/dashboard/ui.mjs`
- `tests/dashboard/wave-panel-drift-truth.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/dashboard/wave-panel-drift-truth.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/dashboard/snapshot-waves.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read #186 and dashboard snapshot wave logic

### Step 1: Fix

- [ ] Wave panel labels respect active diagnosis (drift/orphan overrides optimistic completed)

### Step 2: Tests

- [ ] UI contract test for drift scenario

### Step 3: Testing & Verification

- [ ] Run contract testCommand

### Step 4: Documentation & Delivery

- [ ] Close #186
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Wave panel does not show completed under active drift/orphan diagnosis

## Do NOT

- Redesign full dashboard layout — wave panel labels only
