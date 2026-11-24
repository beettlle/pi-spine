# SP-895: Journal events issues.synced — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-11-24
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Dependencies satisfied (SP-894)
- [x] Grep old journal type strings

---

### Step 1: Rename journal types
**Status:** ✅ Complete

- [x] Emit issues.synced / issues.sync_failed
- [x] Update tests

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Contract testCommand

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
| GitNexus impact on `syncIssuesAfterIntegrate` returned CRITICAL (547 nodes) | Warned, grounded as inflated: index references pre-SP-893 path `src/integrations/github/sync-on-land.mjs`; fan-in is file-level import noise. Actual importers: `src/batch/integrate.mjs` (references no event-name strings) + test file. Change is string-literal only — no symbol/signature changes. | `src/integrations/issues/sync-on-land.mjs` |
| Out-of-scope stale event-name reference in code: user-facing hint string still says `github.issue_sync_failed` | Flagged for follow-up task (not SP-896 — code, not docs); File Scope forbids editing `bin/` | `bin/spine-integrate.mjs:44` |
| Docs/skill references to old names remain (expected) | Owned by SP-896 docs packet per PROMPT | `docs/adoption/operator-runbook.md`, `skills/spine-release-operator/SKILL.md` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-23 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-24 | Step 0 preflight | SP-894 confirmed landed (merge `3ec907ea`); grep found old names in 2 in-scope files + out-of-scope docs/bin |
| 2026-11-24 | Step 1 rename | sed literal rename in module + tests; grep confirms 0 old strings remain, new strings on 10 module / 9 test lines |
| 2026-11-24 | Step 2 verification | Contract testCommand exit 0 (lint clean, typecheck clean, 24 tests pass) |
| 2026-11-24 | Steps committed | `2e6b47b6` (Step 1 rename), `76fd4643` (STATUS steps 2-3) |

---

## Blockers

*None*

---

## Notes

Release v2.35.0 — Partial #387 (journal). Depends on SP-894 to avoid File Scope clash on sync-on-land.

**2026-11-23 prelanded amend:** sync-on-land + tests removed from `fileScopeMustChange` (already on main via SP-893/SP-894); still in File Scope for journal event rename. Contract `testCommand` enforces rename.
