# Task: SP-540 — Validate npm test hardfail

**Created:** 2026-07-08
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Promote warn-only `npm test --` validation to hard error for required/S/M contracts.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement FR-STAB-02 part 1 ([#187](https://github.com/beettlle/pi-spine/issues/187)): when `contract.mode` is `"required"` and task Size is **S** or **M**, `npm test -- <path>` in `testCommand` is a **validation error** (not warning) in `validateContract`. Size **L** retains warning.

**Closes:** [#187](https://github.com/beettlle/pi-spine/issues/187) (partial — SP-541 adds runtime guard)

**Source:** [`docs/PRD-v1.10.1-stabilization-handoff.md`](../../docs/PRD-v1.10.1-stabilization-handoff.md) §6 FR-STAB-02

**Already done (do not re-implement):** SP-522 warn collector, SP-523 skill template, SP-521 generic scope warnings.

## Dependencies

- **Task:** SP-522 (warn collector landed — promote to error)

## Context to Read First

- [`src/tasks/validate-contract-warn.mjs`](../../src/tasks/validate-contract-warn.mjs) — `NPM_TEST_DASH_DASH_RE`, `collectNpmTestDashDashWarnings`
- [`src/tasks/packet/validate-contract.mjs`](../../src/tasks/packet/validate-contract.mjs)
- [`src/config/preflight/discovery.mjs`](../../src/config/preflight/discovery.mjs) — `tasks-validate`
- [`tests/tasks/validate-contract-warn.test.mjs`](../../tests/tasks/validate-contract-warn.test.mjs)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/tasks/validate-contract-warn.mjs`
- `src/tasks/packet/validate-contract.mjs`
- `tests/tasks/validate-contract-warn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/tasks/validate-contract-warn.test.mjs` |
| fileScopeMustChange | `src/tasks/packet/validate-contract.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read SP-522 warn path and PRD FR-STAB-02 criteria
- [ ] Confirm `contract.mode: required` default for new SP-* tasks

### Step 1: Promote warn to error

- [ ] Add `collectNpmTestDashDashErrors` (or extend collector) for required mode + Size S/M
- [ ] Wire into `validateContract` as `validation.errors` (not warnings)
- [ ] Size L: retain warning behavior (documented exception)

### Step 2: Preflight inheritance

- [ ] Verify preflight `tasks-validate` fails when pending packets have the error (via `validatePrompt` → `validation.errors`)

### Step 3: Testing & Verification

- [ ] Update `validate-contract-warn.test.mjs`: required/S/M cases expect `ok: false`
- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `spine tasks validate` errors on `testCommand: npm test -- tests/foo.test.mjs` for required/S/M packets
- [ ] Size L retains warning only
- [ ] Preflight `tasks-validate` fails on pending packets with the pattern

## Do NOT

- Bulk rewrite historical `.DONE` PROMPTs
- Change contract-verify runtime (SP-541 scope)

## Git Commit Convention

- `fix(SP-540): hard-fail npm test -- in required S/M validate`
