# SP-099: CLI symlink entrypoint detection — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-04
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code changes.

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Reproduction sketch confirmed (`path.resolve` mismatch on symlink)
- [ ] All nine `isMainModule` entrypoints identified

---

### Step 1: Shared `isCliEntrypoint` helper
**Status:** ⬜ Not Started

- [ ] `isCliEntrypoint` exported from `bin/spine-cli/shared.mjs`
- [ ] realpath + resolve fallback implemented
- [ ] Plan review completed

---

### Step 2: Wire all bin entrypoints
**Status:** ⬜ Not Started

- [ ] All nine bin files use shared helper
- [ ] `spine-gate.mjs` variant normalized
- [ ] Code review completed

---

### Step 3: Symlink regression test
**Status:** ⬜ Not Started

- [ ] Temp symlink spawn tests pass
- [ ] `isCliEntrypoint` unit cases covered

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77%)
- [ ] All failures fixed

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

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
| 2026-06-04 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
