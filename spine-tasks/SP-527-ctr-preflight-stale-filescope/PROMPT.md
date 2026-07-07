# Task: SP-527 — Preflight stale fileScope redirect

**Created:** 2026-07-07
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Preflight advisory for pre-landed paths; distinct from SP-374/#56 generic warn.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement FR-STA-14: `spine preflight` emits an **advisory** when `fileScopeMustChange` paths are already on `main` (pre-landed), suggesting operator redirect to `STATUS.md` + `## Amendments` ([#159](https://github.com/beettlle/pi-spine/issues/159)). Distinct from SP-374/#56 generic stale warn.

**Closes:** [#159](https://github.com/beettlle/pi-spine/issues/159)

## Dependencies

- **Task:** SP-373 (pre-landed verify semantics)

## Context to Read First

- [`src/config/spine-preflight-lib.mjs`](../../src/config/spine-preflight-lib.mjs)
- [`src/batch/contract-prelanded.mjs`](../../src/batch/contract-prelanded.mjs)
- [`docs/PRD-v1.9.0-contract-guardrails-handoff.md`](../../docs/PRD-v1.9.0-contract-guardrails-handoff.md) §FR-STA-14

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/spine-preflight-lib.mjs`
- `src/batch/spine-preflight-lib.mjs`
- `tests/config/spine-preflight-prelanded.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/config/spine-preflight-prelanded.test.mjs` |
| fileScopeMustChange | `src/config/spine-preflight-lib.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read #159 vs #56 — redirect suggestion is advisory, not blocking error
- [ ] Read SP-373/374 prelanded checks

### Step 1: Advisory redirect

- [ ] When preflight detects pre-landed `fileScopeMustChange` paths, suggest redirect to `spine-tasks/{task}/STATUS.md` + Amendments
- [ ] Non-blocking warning in preflight output

### Step 2: Tests

- [ ] Extend spine-preflight-prelanded tests for redirect message

### Step 3: Testing & Verification

- [ ] Run contract testCommand
- [ ] `spine preflight` still passes with advisory present

### Step 4: Documentation & Delivery

- [ ] Close #159
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Preflight warns on release scope with pre-landed fileScope paths and suggests redirect

## Do NOT

- Block preflight on advisory (warning only)
- Duplicate SP-374 blocking behavior for #56

## Git Commit Convention

- `feat(SP-527): preflight advisory for pre-landed fileScope redirect`
