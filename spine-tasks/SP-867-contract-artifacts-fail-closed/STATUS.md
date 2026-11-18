# SP-867: Contract: reject .. in artifacts; fix ** globs; fail-closed on git diff failure — Status

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

- [ ] GitNexus impact on `findArtifactMatch` / `verifyContract`; report blast radius in STATUS
- [ ] `rg -n "findArtifactMatch|artifactsMustExist|fileScopeMustNotChange" src/batch/contract-exec.mjs tests/batch/`

---

### Step 1: Fail-closed contract checks
**Status:** ⬜ Not Started

- [ ] Reject `..` / out-of-worktree artifact patterns
- [ ] Fix `**` glob search root
- [ ] Fail `fileScopeMustNotChange` when git diff fails

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Add/adjust unit tests for the three behaviors

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged (runbook owned by SP-865)
- [ ] Create `spine-tasks/SP-867-contract-artifacts-fail-closed/.DONE`

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
