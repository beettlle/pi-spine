# SP-485: Contract verify retry — Status

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

---

### Step 1: Add testCommand retry logic
**Status:** ⬜ Not Started

- [ ] Retry logic wrapping testCommand execution
- [ ] Configurable retry count from spine-config
- [ ] Delay between retry attempts
- [ ] Journal contract.test_retry events
- [ ] Targeted tests pass

---

### Step 2: Capture failed testCommand output
**Status:** ⬜ Not Started

- [ ] Write stdout+stderr to .reviews/ on failure
- [ ] Include command, exit code, attempt in log header
- [ ] No interference with retry flow
- [ ] Targeted tests pass

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77% line coverage on in-scope code)
- [ ] Fail-then-succeed retry test
- [ ] All-retries-fail test
- [ ] Configurable retry count test
- [ ] Output capture test
- [ ] No-retry-on-success test
- [ ] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] contract.testRetries config documented
- [ ] Operator runbook updated
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
| 2026-07-03 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
