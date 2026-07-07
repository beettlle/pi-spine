# Task: SP-524 — Planner wave size warning

**Created:** 2026-07-07
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Planner output warning only; prevents mega-wave stalls.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Implement FR-STA-12 (wave size): when `spine plan` produces a wave with **more than 8 tasks**, emit a **hard warning** in plan output ([#143](https://github.com/beettlle/pi-spine/issues/143)). Reference Phase 15 / SP-086–088 stall evidence.

**Closes:** [#143](https://github.com/beettlle/pi-spine/issues/143)

## Dependencies

- **None**

## Context to Read First

- [`src/planner/index.mjs`](../../src/planner/index.mjs)
- [`src/planner/waves.mjs`](../../src/planner/waves.mjs)
- [`docs/PRD-v1.9.0-contract-guardrails-handoff.md`](../../docs/PRD-v1.9.0-contract-guardrails-handoff.md) §FR-STA-12

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/planner/index.mjs`
- `src/planner/waves.mjs`
- `tests/planner/wave-size-warn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/planner/wave-size-warn.test.mjs` |
| fileScopeMustChange | `src/planner/waves.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read `formatFileScopeOverlapWarnings` pattern in waves.mjs for warning style consistency

### Step 1: Wave size warn

- [ ] Add `collectWaveSizeWarnings(waves)` — warn when any wave has >8 tasks
- [ ] Include in `buildPlan` return value and CLI plan output (visible to operator)

### Step 2: Tests

- [ ] `tests/planner/wave-size-warn.test.mjs`: 8 tasks silent, 9 tasks warns (M-CTR-04)

### Step 3: Testing & Verification

- [ ] Run contract testCommand
- [ ] `spine plan pending` still works (warning is non-blocking)

### Step 4: Documentation & Delivery

- [ ] Close #143
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Plan output warns when wave >8 tasks
- [ ] Warning text recommends splitting waves per create-spine-tasks guidance

## Do NOT

- Block plan execution on wave size (warning only)
- Change lane assignment algorithm

## Git Commit Convention

- `feat(SP-524): warn when plan wave exceeds 8 tasks`
