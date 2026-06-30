# SP-351: Doctor stale-worktrees check — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-30
**Review Level:** 1
**Size:** S
**Split from:** SP-335

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-28 | Task staged | Split from SP-335 for issue #26 |
| 2026-06-30 | Step 0 preflight | Read issue #26 + SP-335 PROMPT; SP-350 dependency done |
| 2026-06-30 | Step 1 implementation | Added stale-worktrees doctor check, test, runbook |

---

## Plan (Review Level 1)

1. New `buildStaleWorktreesDoctorCheck` scans `.worktrees/spine-*` vs in-progress batch ID from `.spine/batch-state.json`.
2. Wire into `runDoctorChecks` inside git repo block (preflight inherits via doctor).
3. Regression tests + runbook cleanup section.

---

## Steps

### Step 0: Preflight
- [x] Read issue #26 and superseded SP-335 PROMPT

### Step 1: Implementation
- [x] Implement required behavior

### Step 2: Testing & Verification
- [ ] Contract test passes
- [ ] FULL suite + coverage gate

### Step 3: Delivery
- [ ] Close issue #26
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Required behavior implemented
- [ ] Tests pass with coverage gate
- [ ] Issue #26 closed
