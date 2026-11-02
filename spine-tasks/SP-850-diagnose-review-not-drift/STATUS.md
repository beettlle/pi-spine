# SP-850: Diagnose: a task in review is not state drift; no `resume --force` while the engine is live — Status

**Current Step:** Step 0
**Status:** 🔵 Not Started
**Last Updated:** 2026-11-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `detectBatchStateDrift` and the suggested-command builder; report the blast radius in STATUS
- [ ] `rg -n "resume --force" tests/` — every test that asserts the current `state_drift` suggestion is in the Contract or listed in Discoveries for post-integrate `release:check`
- [ ] Confirm the review and contract event names in `src/batch/journal.mjs`

### Step 1: Drift skip for open post-`.DONE` work
**Status:** ⬜ Not Started

- [ ] Helper: task has an open review or contract verification in the journal
- [ ] `doneInLane` drift skipped only in that case

### Step 2: Live-engine suggestion
**Status:** ⬜ Not Started

- [ ] `state_drift` + running phase + live engine → `spine wait …`; stale/dead engine unchanged

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Open code / final review and open contract verify → no drift
- [ ] Terminal journal with stale cache → drift
- [ ] Suggested command: live → `spine wait …`; dead/stale → `spine batch resume --force`

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-850-diagnose-review-not-drift/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |

## Blockers

*None*
