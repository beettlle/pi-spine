# SP-653: Evidence allowlisted npm chains — Status

**Current Step:** Step 0 — Preflight
**Status:** ⬜ Not Started
**Last Updated:** 2026-07-13
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ⬜ Not Started
- [ ] Document current metacharacter rejection rules
- [ ] Define allowlist + &&-only chain grammar

### Step 1: Implement allowlisted `&&` chains
**Status:** ⬜ Not Started
- [ ] Parse/validate multi-segment allowlisted commands
- [ ] Execute segments sequentially fail-closed
- [ ] Keep scripts/ Phase A path working
- [ ] Reject other metacharacters / expansions

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Add evidence-allowlisted-chains.test.mjs
- [ ] Extend evidence.test.mjs if needed
- [ ] Run contract testCommand
- [ ] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`
- [ ] Comment on #160 Phase B; leave open for Phase C

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| — | — |

## Completion Criteria

- [ ] Allowlisted && chains execute
- [ ] Other metacharacters rejected
- [ ] Phase A scripts/ unchanged
- [ ] #160 remains open with Phase B note

## Blockers

_None._
