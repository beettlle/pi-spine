# SP-890: Config schema integrations.issues — Status

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

- [x] Dependencies satisfied (none)
- [x] Read #387 AC for config shape and fail-closed reject
- [x] Map current validateIntegrationsConfig + resolveGithubSyncOnLandConfig

---

### Step 1: Schema + defaults + reader
**Status:** ✅ Complete

- [x] Defaults issues + provider
- [x] Validate + reject github
- [x] Sync reader uses issues

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Schema + sync tests
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
| GitNexus impact: `validateIntegrationsConfig` CRITICAL (474 impacted, 167 processes) — expected; config validation is on the main load path. Change is behavior-preserving for valid configs; only the legacy `integrations.github` key flips to fail-closed reject | Accepted | `src/config/spine-config-schema.mjs` |
| `INTEGRATIONS_DEFAULTS` impact UNKNOWN (no direct callers resolved) → confirmed via text search: consumed through `CONFIG_V2_SECTION_DEFAULTS` in `merge-defaults.mjs`; deep-merge fills missing `integrations.issues` keys | Resolved | `src/config/defaults.mjs` |
| Schema validation is structural only — `provider` accepts any string (e.g. `"gitlab"` passes schema; runtime backend is still github-only per #387 out-of-scope). Locked in by test | Accepted | `tests/config/integrations-issues-schema.test.mjs` |
| Legacy-key reject uses key-presence check (`"github" in integrations`), so `integrations.github: null` also fails closed | Accepted | `src/config/spine-config-schema.mjs` |
| Stale `gh_missing` operator hints referenced `integrations.github.syncOnLand` → updated to `integrations.issues.syncOnLand` (in-scope file) | Fixed | `src/integrations/github/sync-on-land.mjs` |
| Full-suite `npm run coverage:check` has 61 pre-existing failures in batch/adoption subprocess tests — reproduced on clean baseline (stash test, dry-run test exit=1 without changes). Out of SP-890 scope; full suite gates at post-integrate release:check per orchestration | Noted | — |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-23 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-23 | Step 0 complete | #387 AC read; impact analysis + caller map done (committed efeaa72e) |
| 2026-11-23 | Step 1 complete | defaults/schema/reader changed; helper renamed `resolveIssueSyncOnLandConfig`; module path, journal events, CLI flag untouched (SP-891/894/895 scope) |
| 2026-11-23 | Step 2 complete | Contract testCommand exit 0 (lint ✓ typecheck ✓ 32 targeted tests ✓); 61 full-suite failures confirmed pre-existing on baseline |
| 2026-11-23 | Worktree stash incident resolved | Baseline-verification stash pop raced a background graphify hook rewrite of AGENTS.md/CLAUDE.md; both restored to committed HEAD (no content edits, out of scope), scoped files verified identical to stash, redundant stash entry dropped |
| 2026-11-23 | Step 3 complete | All completion criteria met; Contract testCommand exit 0 re-verified on committed tree (cab6e8ed) |

---

## Blockers

*None*

---

## Notes

Release v2.35.0 — Partial #387 (config).
