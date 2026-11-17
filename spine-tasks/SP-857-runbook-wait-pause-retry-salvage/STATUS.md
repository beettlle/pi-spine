# SP-857: Runbook wait pause-retry salvage — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-16
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Locate runbook sections for `spine wait`, pause/retry, and salvage complete; list sentences that contradict #375/#376/#374

### Step 1: Wait + pause/retry + salvage docs
**Status:** ⬜ Not Started

- [ ] Multi-lane wait wake rule (#375)
- [ ] Pause/retry/resume without stale_engine_pid / false attached ownership (#376)
- [ ] Post-salvage complete/dismiss without `--force` when heal applies (#374)

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract `testCommand` passing (full suite runs at post-integrate `release:check`)
- [ ] All failures fixed

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

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
| 2026-11-16 | Task staged | PROMPT.md created |

## Blockers

*None*
