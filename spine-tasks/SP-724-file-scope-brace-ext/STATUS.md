# SP-724: File-scope overlap: brace globs + ext probes — Status

**Current Step:** Step 4: Documentation & Delivery
**Status:** Completed
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

**Status:** ✅ Complete

- [x] Unit tests for brace expansion in expandScopeEntryProbes
- [x] Analyze integration: overlapping brace scopes → finding emitted

## Step 3: Testing & Verification

**Status:** ✅ Complete

- [x] Run contract `testCommand` only
- [x] Fix all failures from the scoped contract command

## Step 4: Documentation & Delivery

**Status:** ✅ Complete

- [x] Create `.DONE`

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
| 2026-08-25 | Step 2 complete | 6 new planner unit tests + 2 analyze integration tests; contract testCommand passes (35 tests, 0 fail); typecheck clean |
| 2026-08-25 | Docs check | docs/adoption/operator-runbook.md reviewed — no analyze overlap-semantics section exists; change is additive detection with no operator workflow change, so no doc update required |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
