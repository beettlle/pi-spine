# SP-887: Opt-in GitHub issue sync on land — Status

**Current Step:** Step 1 — Parser + sync module
**Status:** 🟡 In Progress
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
**Status:** ⬜ Not Started

- [ ] Mission Closes/Partial parser
- [ ] Opt-in sync + soft-fail + dry-run
- [ ] Journal github.issue_synced

---

### Step 2: Wire into integrate + docs
**Status:** ⬜ Not Started

- [ ] Hook after successful integrate
- [ ] Default off
- [ ] Runbook + release-operator note

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Stubbed parse/action tests
- [ ] Contract testCommand passing

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Must Update docs modified
- [ ] Discoveries logged
- [ ] Create `.DONE`

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
| 2026-11-22 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

Release v2.34.0 — #382 child (#383). Shared parser for SP-889.
