# SP-403: Tail-state diagnosis headline — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read GitHub issue #68
- [ ] Dependencies satisfied

---

### Step 1: Preflight
**Status:** ⬜ Not Started

- [ ] Re-read issue #68 Tier 1 acceptance
- [ ] Simulate tail state: all tasks terminal, phase running

---

### Step 2: Implement tail-state headline
**Status:** ⬜ Not Started

- [ ] When `hasRunningTasks` and `hasPendingTasks` are false but batch not terminal, derive headline from macroPhase
- [ ] Map `needs_merge`, integrate/gate limbo, land-loop milestones to operator-readable strings
- [ ] Preserve generic running headline when workers are active

---

### Step 3: Diagnosis tests
**Status:** ⬜ Not Started

- [ ] Add fixture-based test using archived batch-state shape
- [ ] Assert headline is not bare "is running" without activity hint

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77%)

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Docs updated


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
| 2026-07-01 | Task staged | PROMPT.md and STATUS.md created for GitHub #68 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
