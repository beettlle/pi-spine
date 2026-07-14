# SP-659: `graphify-out` regenerate-after-clean race — Status

**Current Step:** Step 0 — Preflight
**Status:** ⬜ Not Started
**Last Updated:** 2026-07-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ⬜ Not Started
- [ ] Confirm graphify-out markers present
- [ ] Trace sanitize → recheck → fail path

### Step 1: Race-safe re-clean
**Status:** ⬜ Not Started
- [ ] Re-clean / second sanitize before fail-closed land
- [ ] Prefer minimal dirty-check/commit change
- [ ] Add regenerate-after-clean fixture

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Run contract testCommand
- [ ] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`
- [ ] Close #206 when criteria met

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| SP-656 already changed `lane-dirty-check.mjs` on main | Operator amended Contract `fileScopeMustChange` to STATUS.md + new race test (see PROMPT ## Amendments) |

## Completion Criteria

- [ ] Race-safe graphify-out land
- [ ] #206 closable
- [ ] Scoped tests green

## Blockers

_None._
