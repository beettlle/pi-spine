# SP-318: Shared atomic write utility — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-20
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read existing atomic write implementations in settings-set and discover
- [ ] Confirm no other callers need migration in this task

---

### Step 1: Implement shared atomic write module
**Status:** ⬜ Not Started

- [ ] Create src/fs/atomic-write.mjs with writeJsonAtomic and writeTextAtomic
- [ ] Refactor settings-set.mjs and discover.mjs to use shared util
- [ ] Preserve existing fsync/rename semantics

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Add tests/fs/atomic-write.test.mjs
- [ ] Run FULL test suite: npm run typecheck && SPINE_WORKER_STUB=1 npm test
- [ ] Run coverage gate: npm run coverage:check — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

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
