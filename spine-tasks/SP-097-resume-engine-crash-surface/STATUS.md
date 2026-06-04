# SP-097: Resume engine crash failure surfacing — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-04
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Crash path from bug report traced in source

---

### Step 1: Crash handler + journal terminal event
**Status:** ⬜ Not Started

- [ ] `failBatchFromEngineError` (or equivalent) wired
- [ ] `batch.failed` journal event on crash
- [ ] Plan review completed

---

### Step 2: Phase transition + ghost task cleanup
**Status:** ⬜ Not Started

- [ ] Phase not left `running`; enginePid cleared
- [ ] Ghost `running` tasks reconciled in state
- [ ] Code review completed

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Crash simulation test passes
- [ ] FULL suite + coverage pass

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook updated

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-04 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
