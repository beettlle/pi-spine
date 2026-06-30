# SP-386: Format plan wave command hint — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-30
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read format-plan multi-wave Then block

---

### Step 1: Plan hint
**Status:** 🟡 In Progress

- [x] Append wave-scoped start hint for multi-wave plans
- [x] Update format-plan tests

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Update QUICK-REFERENCE if needed

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Multi-wave hints use scope mode + `--wave N`; single-wave keeps task ID list | Implemented | `format-plan.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-30 | Step 0 preflight | Read multi-wave Then block in format-plan.mjs |
| 2026-06-30 | Step 1 implementation | Wave-scoped start hints added |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
