# SP-206: CI trust and SAT-020 guard — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-12
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm SAT-020 integration test passes locally
- [ ] Review CI workflow test job

---

### Step 1: CI regression guard
**Status:** ⬜ Not Started

- [ ] Ensure stub test suite runs on every PR/push to `main`
- [ ] Add or tighten SAT-020 contract assertion if gaps found
- [ ] No new empty catch blocks or TODO/FIXME in `src/` from this change

---

### Step 2: Runbook SAT-020 section
**Status:** ⬜ Not Started

- [ ] Document expected journal sequence: checkpoint_warning → stall kill → salvage → task.failed
- [ ] Link to stall-recovery brief and SAT-020 test file

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures
- [ ] Run build: npm run typecheck

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook updated
- [ ] Create `.DONE`

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
| 2026-06-12 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
