# SP-649: Wrong-cwd config missing message — Status

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
- [ ] Confirm missing-config branch in `spine-config-load.mjs`
- [ ] Reproduce bare `suggestedCommand: "spine init"` today

### Step 1: Honest missing-config message
**Status:** ⬜ Not Started
- [ ] Include resolved project root / `$PWD` in error message
- [ ] Suggest cd-to-root **or** `spine init` (not bare init alone)
- [ ] Keep fail-closed behavior when config is truly absent

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Add wrong-cwd-config-message test
- [ ] Run contract testCommand
- [ ] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| — | — |

## Completion Criteria

- [ ] Missing-config load path mentions cwd and dual remediation
- [ ] Scoped test green

## Blockers

_None._
