# SP-780: Journal tolerates torn lines — Status

**Current Step:** Step 0 (Preflight)
**Status:** ⬜ Not Started
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Reproduce torn-line throw at HEAD
- [ ] List journal read callers
- [ ] Record LOC baselines
- [ ] Dependencies satisfied

### Step 1: Parse tolerance + append guard
**Status:** ⬜ Not Started

- [ ] Per-line try/catch + `{ events, skippedLines }` helper
- [ ] Read return shapes unchanged
- [ ] Append newline guard
- [ ] Doc comment corrected
- [ ] Unit tests

### Step 2: Diagnose signal + abort
**Status:** ⬜ Not Started

- [ ] `signals.journalCorruptLines`
- [ ] Visible in `--diagnose`
- [ ] Abort-with-torn-journal test
- [ ] `reconcile-batch.mjs` ≤ 500 lines

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

_None yet._

## Blockers

_None._
