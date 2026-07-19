# SP-668: Auto-stage untracked files before contract verify — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Required files and paths exist
- [ ] No active batch running

---

### Step 1: Add untracked-file staging helper
**Status:** ⬜ Not Started

- [ ] Locate where contract verify reads the diff for `fileScopeMustChange`
- [ ] Add helper that lists untracked files and matches against `fileScopeMustChange` globs
- [ ] Stage matching untracked files with `git add` before diff check
- [ ] Leave tracked modifications untouched

---

### Step 2: Wire helper into contract verify
**Status:** ⬜ Not Started

- [ ] Call helper in `contract-verify.mjs` before evaluating `fileScopeMustChange`
- [ ] Surface staging failures as clear contract errors
- [ ] Preserve existing behavior when no untracked files exist

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `npm run typecheck` passes
- [ ] Regression test for untracked in-scope file passes
- [ ] Regression test for untracked out-of-scope file passes
- [ ] Targeted test command passes
- [ ] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] STATUS.md updated with discoveries
- [ ] Operator-runbook checked; updated only if relevant

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
| 2026-07-19 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
