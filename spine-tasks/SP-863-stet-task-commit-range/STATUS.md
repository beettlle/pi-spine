# SP-863: stet task commit range — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-16
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read the current baseline/first_task_commit/session-switch block; list exact lines that open `..HEAD` and that finish/restart sessions
- [ ] `rg -n "spine-stet-contract-run|first_task_commit" tests/`

### Step 1: Bound range + preserve dismissals
**Status:** ⬜ Not Started

- [ ] End range at last task-folder commit (not later siblings' HEAD)
- [ ] Avoid dismissal-wiping session restart across task switches when baseline for this task is stable

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Fixture: earlier task re-review excludes later task commits/paths

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract `testCommand` passing
- [ ] All failures fixed

### Step 4: Documentation & Delivery
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
