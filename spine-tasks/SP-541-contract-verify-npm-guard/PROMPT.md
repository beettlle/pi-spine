# Task: SP-541 — Contract-verify npm guard

**Created:** 2026-07-08
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Defense-in-depth runtime block in contract-verify before spawn — prevents mid-batch collateral on grandfathered packets.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement FR-STAB-02 part 2 ([#187](https://github.com/beettlle/pi-spine/issues/187)): `contract-verify.mjs` refuses to execute commands matching `NPM_TEST_DASH_DASH_RE` before spawning — defense in depth for grandfathered packets that bypass validate.

**Closes:** [#187](https://github.com/beettlle/pi-spine/issues/187) (with SP-540)

**Source:** [`docs/PRD-v1.10.1-stabilization-handoff.md`](../../docs/PRD-v1.10.1-stabilization-handoff.md) §6 FR-STAB-02

## Dependencies

- **Task:** SP-540 (validate hard-fail — share `NPM_TEST_DASH_DASH_RE` constant)

## Context to Read First

- [`src/batch/contract-verify.mjs`](../../src/batch/contract-verify.mjs)
- [`src/tasks/validate-contract-warn.mjs`](../../src/tasks/validate-contract-warn.mjs) — export `NPM_TEST_DASH_DASH_RE` if not already exported
- [`docs/PRD-v1.10.1-stabilization-handoff.md`](../../docs/PRD-v1.10.1-stabilization-handoff.md) §6 FR-STAB-02 item 4

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `src/tasks/validate-contract-warn.mjs`
- `tests/batch/contract-verify-npm-scope.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/contract-verify-npm-scope.test.mjs` |
| fileScopeMustChange | `src/batch/contract-verify.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read contract-verify spawn path and SP-540 `NPM_TEST_DASH_DASH_RE` export
- [ ] Confirm fail-closed behavior before subprocess spawn

### Step 1: Runtime guard

- [ ] Import/share `NPM_TEST_DASH_DASH_RE` from validate-contract-warn (export if needed)
- [ ] Before spawn: refuse commands matching pattern with clear error (contract_failed)
- [ ] Do not execute `npm test -- <path>` at runtime

### Step 2: Testing & Verification

- [ ] Create `tests/batch/contract-verify-npm-scope.test.mjs` — verify refuse-before-spawn
- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] contract-verify refuses `npm test --` at runtime before spawn
- [ ] Regression test covers refuse path

## Do NOT

- Change validateContract error logic (SP-540 scope)
- Bulk rewrite historical `.DONE` PROMPTs

## Git Commit Convention

- `fix(SP-541): contract-verify runtime npm test -- guard`
