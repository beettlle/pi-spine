# Task: SP-526 — fileScope resume baseline fix

**Created:** 2026-07-07
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Contract verify timing fix for pre-landed files on resume; touches batch engine.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix [#171](https://github.com/beettlle/pi-spine/issues/171): `fileScopeMustChange` must not fail when target files **landed on main before** resume `sinceCommit`. Honor resume baseline / pre-landed semantics in contract verify (FR-STA-11). Builds on SP-478 resume baseline.

**Closes:** [#171](https://github.com/beettlle/pi-spine/issues/171)

## Dependencies

- **Task:** SP-478 (resume baseline landed)

## Context to Read First

- [`src/batch/contract-verify.mjs`](../../src/batch/contract-verify.mjs)
- [`src/batch/contract-prelanded.mjs`](../../src/batch/contract-prelanded.mjs)
- [`docs/PRD-v1.9.0-contract-guardrails-handoff.md`](../../docs/PRD-v1.9.0-contract-guardrails-handoff.md) §FR-STA-11

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `src/batch/contract-prelanded.mjs`
- `tests/batch/contract-verify-resume.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/contract-verify-resume.test.mjs` |
| fileScopeMustChange | `src/batch/contract-verify.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce #171: file on main before task start commit; contract verify fails fileScopeMustChange on resume
- [ ] Read SP-478 `sinceCommit` / `taskStartCommit` wiring

### Step 1: Pre-landed baseline

- [ ] When `sinceCommit` set, treat paths matching `fileScopeMustChange` that are unchanged since `sinceCommit` as satisfied if pre-landed on main at task start
- [ ] Do not regress SP-373 pre-landed verify behavior

### Step 2: Tests

- [ ] `contract-verify-resume.test.mjs`: pre-landed file + resume sinceCommit → verify passes (M-CTR-02)

### Step 3: Testing & Verification

- [ ] Run contract testCommand
- [ ] Existing contract-verify tests pass

### Step 4: Documentation & Delivery

- [ ] Close #171
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Resume batch with pre-landed fileScope paths does not contract_fail on unrelated diff

## Do NOT

- Change stet CLI behavior
- Break serialized lane scoped diff (SP-416)

## Git Commit Convention

- `fix(SP-526): honor pre-landed fileScope on resume sinceCommit`
