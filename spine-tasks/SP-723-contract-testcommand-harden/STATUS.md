# SP-723: Harden contract testCommand execution — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-08-25
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code changes.

---

## Step 1: Reject dangerous metachars

**Status:** ⬜ Not Started

- [ ] Reject `$`, backticks, `;`, `|`, `&&`, `||` before shell spawn
- [ ] Emit distinct error copy from #254 gate evidence path
- [ ] Prefer parse-time validation; fail closed at contract verify if needed

## Step 2: Tests

**Status:** ⬜ Not Started

- [ ] Cover rejection cases in `tests/batch/contract-exec.test.mjs`
- [ ] Keep happy-path valid testCommand fixtures green

## Step 3: Testing & Verification

**Status:** ⬜ Not Started

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

## Step 4: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| | | | |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| | | |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-25 | Task staged | PROMPT.md and STATUS.md created for v2.16.0 release |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
