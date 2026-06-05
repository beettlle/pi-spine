# Task: SP-099 — CLI symlink entrypoint detection

**Created:** 2026-06-04
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Global `npm install -g` invokes bin via symlink; `path.resolve(argv[1]) === path.resolve(__filename)` is always false, so every `isMainModule` gate skips the CLI with exit 0 and no output — high operator impact across all bin entrypoints.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix the **silent no-op** when `spine` (and sibling bin scripts) are invoked through npm global symlinks. Centralize symlink-aware main-module detection in `bin/spine-cli/shared.mjs` and replace duplicated `isMainModule` checks in every affected entrypoint. Add a regression test that spawns Node with `argv[1]` set to a temp symlink targeting `bin/spine.mjs`.

**Customer bug:** `spine plan pending` via `/usr/local/bin/spine` exits 0 with zero stdout/stderr; direct `node …/bin/spine.mjs` works.

## Dependencies

- **None**

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md` — Phase 18

**Tier 3:**
- `bin/spine.mjs` — current `isMainModule` gate (~L229)
- `bin/spine-cli/shared.mjs` — add `isCliEntrypoint()` here
- `bin/spine-gate.mjs` — variant uses `fileURLToPath` vs `path.resolve` (same symlink failure)
- `tests/cli/spine-router.test.mjs` — existing spawn patterns (direct path only today)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-cli/shared.mjs`
- `bin/spine.mjs`
- `bin/spine-plan.mjs`
- `bin/spine-doctor.mjs`
- `bin/spine-deps.mjs`
- `bin/spine-settings.mjs`
- `bin/spine-rules.mjs`
- `bin/spine-review-step.mjs`
- `bin/spine-report-progress.mjs`
- `bin/spine-gate.mjs`
- `tests/cli/cli-entrypoint-symlink.test.mjs` (new)
- `tests/cli/spine-router.test.mjs` (extend symlink case if cleaner than new file)
- `docs/adoption/operator-runbook.md` (global install note)

## Steps

### Step 0: Preflight

- [ ] Confirm reproduction sketch: `path.resolve(symlink) !== path.resolve(real bin)` for global layout
- [ ] `grep isMainModule bin/` lists all nine entrypoints above

### Step 1: Shared `isCliEntrypoint` helper

> **Plan-review checkpoint**

- [ ] Export `isCliEntrypoint(importMetaUrl, argv1 = process.argv[1])` from `bin/spine-cli/shared.mjs`
- [ ] Compare `fs.realpathSync(argv1)` to `fs.realpathSync(fileURLToPath(importMetaUrl))` when both exist
- [ ] Fall back to `path.resolve` equality when realpath throws (missing path edge case)
- [ ] Document that Node ≥22 is required (already enforced by package `engines`)
- [ ] Call `spine_review_step` after this step

### Step 2: Wire all bin entrypoints

> **Code review checkpoint**

- [ ] Replace local `isMainModule` in all nine files with `isCliEntrypoint(import.meta.url)` (import from `./spine-cli/shared.mjs` or correct relative path per file)
- [ ] Normalize `spine-gate.mjs` to the same helper (remove one-off `fileURLToPath === path.resolve` variant)
- [ ] Preserve export-only behavior when imported as a module (CLI must not run)
- [ ] Manual smoke: `node bin/spine.mjs help` still works
- [ ] Call `spine_review_step` after this step

### Step 3: Symlink regression test

- [ ] Add test: create temp dir, symlink `spine-link` → `bin/spine.mjs`, `spawnSync(node, [symlinkPath, "help"])` → non-empty stdout, status 0
- [ ] Add test: symlink + `plan` or `version` subcommand (minimal fixture if needed for `plan`)
- [ ] Add unit test for `isCliEntrypoint` true when argv1 is symlink and false when argv1 is unrelated script
- [ ] Run targeted: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 node --test tests/cli/cli-entrypoint-symlink.test.mjs tests/cli/spine-router.test.mjs`

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on new/changed code
- [ ] All failures fixed

### Step 5: Documentation & Delivery

- [ ] Operator runbook: note global install uses symlinks; fixed in SP-099; verify with `spine version`
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — global install / symlink verification one-liner

**Check If Affected:**
- `docs/adoption/bootstrap-checklist.md` — install verification steps
- `README.md` — if install section mentions `which spine`

## Completion Criteria

- [ ] `spine help` (and `spine plan pending` in a configured project) invoked via temp symlink to `bin/spine.mjs` produces output or a clear error — never silent exit 0
- [ ] Direct `node bin/spine.mjs …` invocation unchanged
- [ ] All nine entrypoints use shared helper
- [ ] All tests passing; coverage ≥77%

## Git Commit Convention

- `feat(SP-099): complete Step N — description`
- `test(SP-099): symlink CLI entrypoint regression`

## Do NOT

- Change npm `bin` mapping or package name
- Fix `validateWorkerLaunchScriptPath` `./scripts/` normalization (tracked as SP-100)
- Add shell-based global install tests in CI (Node symlink test is sufficient)

---

## Amendments (Added During Execution)
