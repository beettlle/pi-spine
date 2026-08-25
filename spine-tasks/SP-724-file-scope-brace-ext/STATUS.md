# SP-724: File-scope overlap: brace globs + ext probes — Status

**Current Step:** Step 2: Regression tests
**Status:** 🟡 In Progress
**Last Updated:** 2026-08-25
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code changes.

---

## Step 1: Brace + extension probes

**Status:** ✅ Complete

- [x] Expand `{a,b}` brace patterns into concrete probe paths
- [x] Extend probe extensions (`.json`, `.cjs`, `.yaml`, `.yml`) or bounded tree walk
- [x] Avoid false-positive storms on large repos (bound depth/walk)

## Step 2: Regression tests

**Status:** 🟡 In Progress

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
| 2026-08-25 | Brace expansion capped at 32 variants per entry; wider `{...}` sets are truncated in lexical order, so overlap detection is conservative-partial beyond the cap | Bounds probe storms (≤ ~930 probes/entry); documented tradeoff |
| | | |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-25 | Task staged | PROMPT.md and STATUS.md created for v2.16.0 release |
| 2026-08-25 | Step 1 started | Impact analysis via GitNexus: LOW risk (5 symbols, Planner module only). Plan: capped brace expansion + extended probe extensions in planner/file-scope.mjs; analyze delegates to glob-aware planner fileScopesOverlap |
| 2026-08-25 | Step 1 complete | Brace expansion (cap 32 variants) + .json/.cjs/.yaml/.yml probes; analyze/index.mjs re-exports planner overlap. Smoke-checked overlap cases manually |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
