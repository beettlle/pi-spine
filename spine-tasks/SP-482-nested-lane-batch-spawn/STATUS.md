# SP-482: Guard against nested batch spawns in lane worktrees — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Required files exist
- [x] Dependencies satisfied
- [x] Understand current worker spawn env vars
- [x] Confirm no existing nested-spawn guard

---

### Step 1: Set SPINE_IS_WORKER env in worker spawn
**Status:** ✅ Complete

- [x] Add SPINE_IS_WORKER=1 to worker child env
- [x] Verify propagation to all worker child processes

---

### Step 2: Add nested-spawn guard to startBatch
**Status:** ⬜ Not Started

- [ ] Check SPINE_IS_WORKER env at startBatch entry
- [ ] Check CWD against .worktrees/spine-* pattern
- [ ] Emit engine.nested_spawn_blocked journal event
- [ ] Return { ok: false } with clear error

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77% line coverage on in-scope code)
- [ ] Guard blocks with SPINE_IS_WORKER=1
- [ ] Guard blocks in worktree CWD
- [ ] Normal startBatch still succeeds (regression)
- [ ] Worker env includes SPINE_IS_WORKER=1
- [ ] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Operator runbook updated
- [ ] Worker agent docs reviewed

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
| 2026-07-03 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
