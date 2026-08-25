# SP-724: File-scope overlap: brace globs + ext probes — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-08-25
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code changes.

---

## Step 1: Brace + extension probes

**Status:** ⬜ Not Started

- [ ] Expand `{a,b}` brace patterns into concrete probe paths
- [ ] Extend probe extensions (`.json`, `.cjs`, `.yaml`, `.yml`) or bounded tree walk
- [ ] Avoid false-positive storms on large repos (bound depth/walk)

## Step 2: Regression tests

**Status:** ⬜ Not Started

- [ ] Unit tests for brace expansion in expandScopeEntryProbes
- [ ] Analyze integration: overlapping brace scopes → finding emitted

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
