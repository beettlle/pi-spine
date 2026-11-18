# SP-868: Gate approval-streak: lock streak read-modify-write (#314 remainder) — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-18
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm SP-824 fail-closed behavior still present; locate streak I/O module(s)
- [ ] GitNexus impact on streak helpers; report in STATUS

---

### Step 1: Lock streak RMW
**Status:** ⬜ Not Started

- [ ] Add lock around streak increment/reset/read used for auto-approve
- [ ] Keep SP-824 journal + streak_unreliable behavior

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Lock / concurrency coverage; keep existing streak-failure tests green

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged (runbook owned by SP-866)
- [ ] Create `spine-tasks/SP-868-gate-streak-lock/.DONE`

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
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
