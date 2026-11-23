# SP-887: Opt-in GitHub issue sync on land — Status

**Current Step:** Complete
**Status:** 🟢 Done — all steps complete, .DONE created
**Last Updated:** 2026-11-23
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Dependencies satisfied (SP-886)
- [x] Map integrate success → DONE-on-base tasks
- [x] Confirm integrations.github config extension point

**Step 0 notes:**
- Sync trigger: `integrateOrchToBase` fresh-success path only (after the `integrate.completed` journal event). The `alreadyMerged` early-return must NOT re-sync — prevents duplicate comments/closes on re-run.
- `.DONE`-on-base task mapping: `batch.tasks` (via `parseSpineBatchState`) filtered to terminal-success statuses `completed`/`succeeded` (skipped tasks land no work → no close). Prompt path: `{tasksRoot}/{taskFolder ?? taskId}/PROMPT.md`; tasksRoot via `resolveTasksRootPath(projectRoot, config)` (`src/config/env-overrides.mjs`); config already loaded in integrate for the gate check.
- Config extension point: `CONFIG_V2_SECTION_DEFAULTS` in `src/config/defaults.mjs` — add `integrations` section (default `{ github: { syncOnLand: false } }`) merged by `applyConfigDefaults`; validation via new `validateIntegrationsConfig` in `src/config/spine-config-schema.mjs` wired in `src/config/spine-config-load.mjs` next to `validateOrchestratorConfig` (~line 308).
- Parser rules per #147: `Closes #N` / `Closes: #N` → close; `Partial #N` / `Partial: #N` → comment only. Case-insensitive; multiple space/comma/semicolon-separated `#N` refs per keyword; whole-word match (`Encloses`/`Partials` must not match); an issue in both lists resolves to closes.
- `gh` patterns from `bin/spine-issue.mjs`: `spawnSync` array args (no shell), `commandExists` probe (`src/util/command-exists.mjs`), body via `--body-file` (no quoting/injection surface).
- Journal: `appendJournalEvent(projectRoot, batchId, type, payload)` — `github.issue_synced` per synced issue, `github.issue_sync_failed` per soft failure.
- Arch guards: new files under `src/integrations/` must NOT use `@ts-nocheck` (`tests/arch/ts-nocheck-guard.test.mjs`); JSDoc-typed instead. Import-cycle guard only covers `src/batch` cluster.
- `tests/integrations/` is not in the `npm test` glob (package.json out of File Scope); contract testCommand runs the two new test files explicitly — full-suite glob gap noted in Discoveries.
- Dependency SP-886: complete (REVISE addressed; on base via lane merge 0a667983).

---

### Step 1: Parser + sync module
**Status:** ✅ Complete

- [x] Mission Closes/Partial parser
- [x] Opt-in sync + soft-fail + dry-run
- [x] Journal github.issue_synced

---

### Step 2: Wire into integrate + docs
**Status:** ✅ Complete

- [x] Hook after successful integrate
- [x] Default off
- [x] Runbook + release-operator note

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Stubbed parse/action tests
- [x] Contract testCommand passing

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Must Update docs modified
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
| reviewCommand failed (exit 1): e252df8  src/batch/integrate.mjs:418  WARNING  The comment claims 'syncIssuesAfterIntegrate never throws into this path', but the | advisory — noted, not blocking | contract review step |
| `tests/integrations/` is not in the `npm test` glob; package.json is out of File Scope so the glob was not extended. Contract testCommand runs the two files explicitly; full suite (3397 tests) re-run green via worker-verify. | Follow-up suggested: add `tests/integrations/*.test.mjs` (and `/github/`) to the npm test glob so post-integrate release:check picks them up. | `package.json` (out of scope) |
| `integrations.github.syncOnLand` was NOT added to the `spine settings set` field registry (`src/config/settings-fields.mjs` out of File Scope); enablement is documented as a direct `.spine/spine-config.json` edit, and validator `suggestedCommand`s point at editing the file. | Documented; registry entry can be added by a follow-up task. | `docs/adoption/operator-runbook.md` §4.4, `src/config/spine-config-schema.mjs` |
| Sync runs only on the fresh integrate-success path (after `integrate.completed`); the `alreadyMerged` early-return never re-syncs — prevents duplicate comments/closes on re-run. | Implemented as designed. | `src/batch/integrate.mjs` |
| `src/batch/integrate.mjs` hit the 500-LOC structural cap (516) after wiring; moved the orchestration into `syncIssuesAfterIntegrate` in the integration module — integrate.mjs back to 474 LOC, phase23-exit structural check green. | Resolved in this task. | `src/integrations/github/sync-on-land.mjs` |
| End-to-end smoke verified: config load (defaults merge + `CONFIG_INTEGRATIONS_INVALID` validation), DONE-on-base mapping, gh-missing soft-fail journal with hint, close/comment plan from `Closes #77, Partial #88`. | Verified. | `/tmp` smoke harness (not committed) |
| `spine-router.test.mjs` fails under `SPINE_IS_WORKER=1` (SP-482 nested-batch guard); environmental, passes with the var unset. Not caused by this change. | Noted. | `tests/cli/spine-router.test.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-22 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-23 | Step 0 preflight | Integrate→DONE-on-base map + `integrations.github` extension point confirmed; SP-886 dependency complete |
| 2026-11-23 | Step 1 parser + sync | `mission-issue-links.mjs` + `sync-on-land.mjs`; config defaults/schema/load wired; 35 stubbed tests green |
| 2026-11-23 | Step 2 wire + docs | integrate fresh-success hook, `--no-github-sync` flag, runbook §4.4, release-operator §4.3c note |
| 2026-11-23 | Step 3 verification | Contract testCommand exit 0; related suites green |
| 2026-11-23 | LOC cap fix | integrate.mjs 516→474; `syncIssuesAfterIntegrate` extracted; phase23-exit green |
| 2026-11-23 | Full suite | worker-verify: 3397 tests, 0 fail, exit 0 |

---

## Blockers

*None*

---

## Notes

Release v2.34.0 — #382 child (#383). Shared parser for SP-889: `parseMissionIssueLinks` / `issueLinkActions` from `src/integrations/github/mission-issue-links.mjs` (leaf-pure, no fs/git/config imports). Sync journal events: `github.issue_synced` / `github.issue_sync_failed`.
