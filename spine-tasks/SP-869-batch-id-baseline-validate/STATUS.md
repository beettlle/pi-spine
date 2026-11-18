# SP-869: Validate --batch IDs at CLI entry points; sanitize review baseline — Status

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

- [ ] `rg -n "--batch|validateBatchId" bin/ src/cli/ src/batch/` — list entry points missing validation
- [ ] GitNexus impact on `validateBatchId` / review baseline; report in STATUS

---

### Step 1: Validate --batch + baseline
**Status:** ⬜ Not Started

- [ ] Wire `validateBatchId` at all CLI `--batch` readers listed in Mission
- [ ] Add baseline allowlist helper; use in review-step / review-scope before git/prompt

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Malicious `--batch` rejected
- [ ] Malicious baseline rejected; safe SHA still works

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-869-batch-id-baseline-validate/.DONE`

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
