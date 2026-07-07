# SP-521: Scoped contract verify for patch tasks — Status

**Current Step:** Step 3
**Status:** ⏳ In Progress
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
**Status:** ⏳ In Progress

- [ ] Run contract testCommand
- [ ] `spine tasks validate SP-516` shows warn (not error)

### Step 4: Documentation & Delivery
**Status:** ⏳ Pending

- [ ] Comment Partial on #141
- [ ] Create `.DONE`

---

## Blockers

*None*
