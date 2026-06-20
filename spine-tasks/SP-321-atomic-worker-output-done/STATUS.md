# SP-321: Atomic worker-output and .DONE — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-20
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Trace .DONE write and read paths across engine and workers
- [ ] Review SP-313 worker_done_missing behavior

---

### Step 1: Apply atomic writes to worker-output and .DONE
**Status:** ⬜ Not Started

- [ ] Atomic write for worker-output logs
- [ ] Atomic write for .DONE with structured JSON content
- [ ] Update stub and agent-session workers consistently

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Test partial .DONE rejection if applicable
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Extend operator-runbook atomic writes section
- [ ] Create .DONE

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
| 2026-06-20 | Task staged | PROMPT.md and STATUS.md created (Phase 40) |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
