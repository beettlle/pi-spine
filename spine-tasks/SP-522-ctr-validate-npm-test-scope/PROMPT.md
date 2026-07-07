# Task: SP-522 — Validate npm test -- scope

**Created:** 2026-07-07
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Validator tightening for `npm test -- <file>` false-scoping; builds on SP-521 generic warn.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement FR-STA-10: `spine tasks validate` must **reject or hard-warn** when Contract `testCommand` uses `npm test -- <single-file>` — npm runs the **full suite**, not the path argument ([#187](https://github.com/beettlle/pi-spine/issues/187), [#141](https://github.com/beettlle/pi-spine/issues/141)). Extend [`src/tasks/validate-contract-warn.mjs`](../../src/tasks/validate-contract-warn.mjs) with explicit `npm test --` detection and recommend scoped `node --test` pattern.

**Closes:** [#187](https://github.com/beettlle/pi-spine/issues/187), [#141](https://github.com/beettlle/pi-spine/issues/141)

## Dependencies

- **None**

## Context to Read First

- [`docs/PRD-v1.9.0-contract-guardrails-handoff.md`](../../docs/PRD-v1.9.0-contract-guardrails-handoff.md) §FR-STA-10
- [`src/tasks/validate-contract-warn.mjs`](../../src/tasks/validate-contract-warn.mjs) (SP-521 baseline)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/tasks/validate-contract-warn.mjs`
- `src/tasks/packet/validate-contract.mjs`
- `tests/tasks/validate-contract-warn.test.mjs`
- `tests/cli/tasks-validate-contract.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/tasks/validate-contract-warn.test.mjs tests/cli/tasks-validate-contract.test.mjs` |
| fileScopeMustChange | `src/tasks/validate-contract-warn.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read SP-521 `collectTestCommandScopeWarnings` — avoid duplicating generic `npm test` warn; add specific `npm test --` path detection
- [ ] Confirm issue #187 reproduction: `npm test -- tests/foo.test.mjs` runs full suite

### Step 1: Validator detection

- [ ] Add `collectNpmTestDashDashWarnings` (or extend existing) for `npm test -- <path>` pattern on S/M tasks
- [ ] Wire into `validateContract` — error in `required` mode or hard warning with fix hint recommending `node --test`

### Step 2: Tests

- [ ] Unit tests: warn/error on `npm test -- tests/foo.test.mjs`; pass on `node --test tests/foo.test.mjs`
- [ ] CLI integration: `spine tasks validate` surfaces message for fixture packet with bad testCommand

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `npm run coverage:check` unchanged globally (integrate gate owns full coverage)

### Step 4: Documentation & Delivery

- [ ] Comment on #187 and #141 with validate behavior
- [ ] Create `.DONE`

## Completion Criteria

- [ ] `spine tasks validate` fails or warns on `testCommand: npm test -- tests/foo.test.mjs` (M-CTR-01)
- [ ] Scoped `node --test` pattern documented in warning hint

## Do NOT

- Re-implement SP-521 coverage:check warn (already landed)
- Change contract verify runtime behavior — validate-time only

## Git Commit Convention

- `feat(SP-522): detect npm test -- false scope in validate`
