# SP-865: Runbook: contract artifactsMustExist / fileScopeMustNotChange fail-closed — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-18
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Locate runbook contract / fileScopeMustNotChange sections; list sentences that contradict fail-closed #309

---

### Step 1: Contract fail-closed docs
**Status:** ✅ Complete

- [x] Document artifactsMustExist `..` rejection and `**` glob behavior
- [x] Document fileScopeMustNotChange fail-closed when git diff fails
- [x] Cross-link SP-867 / #309

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `rg -l 'operator-runbook.md' tests/` and run only hits with `node --experimental-strip-types --test --test-reporter=dot <files>` (none → note "no tests reference this doc")
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-865-runbook-contract-fail-closed/.DONE`

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
