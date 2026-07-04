# SP-491: Contract verify worker env isolation — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-04
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read issue #155 acceptance criteria
- [ ] Read runContractTestCommand
- [ ] Confirm SPINE_IS_WORKER in worker spawn env

---

### Step 1: Add contract test env sanitizer
**Status:** ⬜ Not Started

- [ ] buildContractTestEnv helper added
- [ ] spawnSync uses sanitized env

---

### Step 2: Regression test
**Status:** ⬜ Not Started

- [ ] contract-verify-worker-env.test.mjs added
- [ ] Worker env not inherited by subprocess
- [ ] Scoped testCommand passes under worker env

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77%)
- [ ] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook updated if behavior changed
- [ ] Issue #155 closed
- [ ] Discoveries logged

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
| 2026-07-04 | Task staged | PROMPT.md and STATUS.md created (#155) |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
