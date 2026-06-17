# SP-256: Fix commandExists pi availability check — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-17
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Reproduce bug with nonexistent command
- [ ] Confirm correct pattern in `bin/get-version.mjs`

---

### Step 1: Shared commandExists module
**Status:** ⬜ Not Started

- [ ] Add `src/util/command-exists.mjs`
- [ ] Wire review.mjs and worker-host.mjs
- [ ] Re-export from bin/get-version.mjs
- [ ] Plan review complete

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Unit tests for commandExists
- [ ] Review spawn regression test
- [ ] Code review complete

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate ≥77%
- [ ] Typecheck passes

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged if needed
- [ ] `.DONE` created

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
| 2026-06-17 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
