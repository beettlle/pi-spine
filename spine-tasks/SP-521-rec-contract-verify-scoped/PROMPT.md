# Task: SP-521 — Scoped contract verify for patch tasks

**Created:** 2026-07-07
**Size:** S

## Review Level: 1 (Final)

**Assessment:** Operator recovery fix — prevent full-suite `coverage:check` in S-task contract failures.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement [#141](https://github.com/beettlle/pi-spine/issues/141) guidance for v1.8.1 release: S-sized patch tasks must use **scoped** `testCommand` contracts (no chained `npm run coverage:check`). Add `spine tasks validate` warning when `testCommand` includes full coverage gate; fix SP-516 packet as reference.

**Closes:** [#141](https://github.com/beettlle/pi-spine/issues/141) (Partial)

## Dependencies

- SP-520

## File Scope

- `src/tasks/validate-contract-warn.mjs`
- `tests/tasks/validate-contract-warn.test.mjs`
- `spine-tasks/SP-516-rec-status-classification/PROMPT.md`
- `skills/create-spine-tasks/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/tasks/validate-contract-warn.test.mjs` |
| fileScopeMustChange | `src/tasks/validate-contract-warn.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read #141 comment (batch `20260707T164359` / SP-516 evidence)
- [ ] Read `docs/PRD-v1.9.0-contract-guardrails-handoff.md` §scoped testCommand

### Step 1: Validator warn

- [ ] Warn when PROMPT contract `testCommand` chains `coverage:check` or `npm test` on S/M patch tasks

### Step 2: Packet + skill fix

- [ ] Remove `npm run coverage:check` from SP-516 contract (scoped tests only)
- [ ] Add create-spine-tasks anti-pattern row for coverage-in-testCommand

### Step 3: Testing & Verification

- [ ] Run contract testCommand
- [ ] `spine tasks validate SP-516` shows warn (not error)

### Step 4: Documentation & Delivery

- [ ] Comment Partial on #141
- [ ] Create `.DONE`

## Completion Criteria

- [ ] S-task contracts cannot silently chain full coverage suite without validate warning
- [ ] SP-516 packet uses scoped testCommand only

## Do NOT

- Change global coverage gate threshold (integrate gate owns full coverage)
- Break existing L-task contracts that legitimately need coverage:check
