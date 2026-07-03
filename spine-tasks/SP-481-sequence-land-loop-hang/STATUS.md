# SP-481: Sequence land loop hang after integrate.started — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Required files and paths exist
- [ ] Dependencies satisfied
- [ ] Understand syncPlumbingMergePathsToWorktree per-file loop
- [ ] Confirm journal event call sites

---

### Step 1: Add timeout to syncPlumbingMergePathsToWorktree
**Status:** ⬜ Not Started

- [ ] Add configurable timeout to git subprocess calls
- [ ] Abort sync loop on timeout with failure indicator
- [ ] Best-effort cleanup on partial sync failure

---

### Step 2: Emit integrate.failed on post-merge hang
**Status:** ⬜ Not Started

- [ ] Wrap post-merge block in try/catch with integrate.failed emission
- [ ] Return { ok: false, failureClass: "IntegrateTimeout" }
- [ ] Include mergeCommitLanded flag when merge ref is safe

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77% line coverage on in-scope code)
- [ ] Timeout triggers integrate.failed test
- [ ] Happy-path integrate.completed regression test
- [ ] Partial sync failure returns correct result
- [ ] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Operator runbook updated with IntegrateTimeout
- [ ] Batch lifecycle docs reviewed

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
