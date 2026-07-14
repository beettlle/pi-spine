# SP-660: Single resume owner — Status

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
- [ ] Read SP-533 concurrent lock gaps
- [ ] Trace resume_handoff_started for detached vs attached

### Step 1: Fail-fast second resume
**Status:** ⬜ Not Started
- [ ] Fail-fast while lock/engine owns batch
- [ ] Clear operator error; no dual engines
- [ ] Add paired detached/attached tests

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Run contract testCommand
- [ ] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`
- [ ] Close #207 when criteria met

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| — | — |

## Completion Criteria

- [ ] Single resume owner fail-fast
- [ ] #207 closable
- [ ] Scoped tests green

## Blockers

_None._
