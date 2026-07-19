# SP-671: Execute matrix sub-lanes in parallel worktrees — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Required files and paths exist
- [ ] SP-670 and SP-672 landed on `main`

---

### Step 1: Provision worktree per matrix row
**Status:** ⬜ Not Started

- [ ] Add worktree provisioning for sub-lanes
- [ ] Deterministic naming from sub-lane ID
- [ ] Reuse setup/cleanup

---

### Step 2: Run sub-lanes in parallel up to maxParallel
**Status:** ⬜ Not Started

- [ ] Schedule each row as sub-lane
- [ ] Respect maxParallel
- [ ] Run substituted command per row
- [ ] Track per-row status

---

### Step 3: Aggregate sub-lane outcomes
**Status:** ⬜ Not Started

- [ ] Parent task success if all rows succeed
- [ ] Parent task failure if any row fails
- [ ] Surface failing row
- [ ] Write per-row status to journal or nested state
- [ ] `spine status` shows aggregated state

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `npm run typecheck` passes
- [ ] Matrix execution e2e test passes
- [ ] Failing row fails whole task test passes
- [ ] maxParallel limit test passes
- [ ] All failures fixed

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] STATUS.md updated
- [ ] Notes captured for SP-673

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
