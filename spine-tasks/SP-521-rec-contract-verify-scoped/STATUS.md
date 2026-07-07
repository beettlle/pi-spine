# SP-521: Scoped contract verify for patch tasks — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-07-07
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read #141 comment (batch `20260707T164359` / SP-516 evidence)
- [x] Read `docs/PRD-v1.9.0-contract-guardrails-handoff.md` §scoped testCommand

### Step 1: Validator warn
**Status:** ✅ Complete

- [x] Warn when PROMPT contract `testCommand` chains `coverage:check` or `npm test` on S/M patch tasks

### Step 2: Packet + skill fix
**Status:** ✅ Complete

- [x] Remove `npm run coverage:check` from SP-516 contract (scoped tests only)
- [x] Add create-spine-tasks anti-pattern row for coverage-in-testCommand

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run contract testCommand (12/12 pass)
- [x] `spine tasks validate SP-516` passes with zero warnings after fix

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Comment Partial on #141
- [x] Create `.DONE`

---

## Blockers

*None*
