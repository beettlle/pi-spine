# SP-893: Move sync-on-land — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-11-23
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Dependencies satisfied (SP-892)
- [x] List importers

---

### Step 1: Move + rewire
**Status:** ✅ Complete

- [x] Move module + integrate import
- [x] Move tests; remove github/ dir

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Contract testCommand (lint ✓ typecheck ✓ 24 tests ✓ exit 0)

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Old-path mentions remain comment-only in `src/cli/board-select.mjs:30,71` and `src/integrations/issues/providers/github.mjs:5` | Deferred to SP-896 (prose strings, per PROMPT Step 0) | Execution Log |
| GitNexus CRITICAL impact on `syncIssuesAfterIntegrate` was file-level CALLS noise; real blast radius = 1 production import + 1 test | Accepted — exports unchanged, contract suite green | Execution Log |
| BODY_DIR renamed `.spine/github-sync` → `.spine/issues-sync`; stale dirs in existing workspaces are harmless (best-effort temp bodies, never read back) | Done per PROMPT optional item | Step 1 |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-23 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-23 | Step 0 preflight | SP-892 landed (`da9ea67f`); provider at `src/integrations/issues/providers/github.mjs`. Code importers of sync-on-land: only `src/batch/integrate.mjs:30` + old test. Comment-only refs (out of scope, SP-896): `src/cli/board-select.mjs:30,71`, `src/integrations/issues/providers/github.mjs:5` |
| 2026-11-23 | Impact analysis | GitNexus impact on `syncIssuesAfterIntegrate` = CRITICAL (547 nodes) but dominated by file-level CALLS edges (conf 0.85); symbol-level grep confirms single production import + test. Exports unchanged → risk contained |
| 2026-11-23 | Step 1 | `git mv` module + test to `integrations/issues/`; removed empty `src/integrations/github/` + `tests/integrations/github/`. Rewired: moved module now imports `./mission-issue-links.mjs` + `./providers/github.mjs` (typedefs too); integrate.mjs imports `../integrations/issues/sync-on-land.mjs`; test imports new path. BODY_DIR renamed to `.spine/issues-sync` (only module + test referenced it). `--no-github-sync` flag and `github.*` journal events untouched (SP-894/SP-895) |
| 2026-11-23 | Step 2 | Contract `testCommand`: `npm run lint` ✓, `npm run typecheck` ✓ (both tsconfigs), 24 tests pass, exit 0 |
| 2026-11-23 | Completion criteria | Module at `src/integrations/issues/sync-on-land.mjs`; `src/integrations/github/` + `tests/integrations/github/` gone; integrate imports new path; testCommand exit 0 — all met |

---

## Blockers

*None*

---

## Notes

Release v2.35.0 — Partial #387 (sync path move).
