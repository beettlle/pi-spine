# Task: SP-822 — Doctor warns when context-rewriting pi extensions can reach reviewers

**Created:** 2026-10-10
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** New advisory doctor check that reads installed pi packages from disk. It must never fail doctor or preflight, and must not slow doctor down on large installs.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** Doctor and preflight have no check that would have caught #334 before a batch started. Pi extensions observe or rewrite requests with `pi.on(...)` handlers. The relevant events are `context`, `context_with_system`, and `before_provider_request` (`node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` ~75-115). Installed packages are listed in `~/.pi/agent/settings.json` and `<project>/.pi/settings.json` under `packages`. `src/doctor/pi-extension-conflict.mjs` already reads those lists (`resolvePiAgentDir`, `readPiPackageSources`, `resolvePiPackageSourcePath`). A package declares extension entry files in `package.json` `pi.extensions`, or pi discovers `.ts`/`.js` files in conventional directories when there is no manifest (`docs/packages.md` ~55-75). SP-819 makes reviewers pass `-ne` unless `agents.reviewer.loadUserExtensions === true`, so the risk exists only when that opt-out is set. Doctor checks are assembled in `src/doctor/run-doctor-checks.mjs` (~346 pushes the extension-conflict check).

## Mission

Partial #334 — `spine doctor` warns when an installed pi package registers a `context`, `context_with_system`, or `before_provider_request` handler **and** reviewers load user extensions.

1. **Scanner** — new `src/doctor/pi-extension-hooks.mjs`:
   - `export function findContextRewritingExtensions({ projectRoot, agentDir })` → `{ packages: Array<{ source: string, hooks: string[] }> }`. For each package source from user and project settings, resolve its root (reuse the helpers in `pi-extension-conflict.mjs`), read the `pi.extensions` entries from `package.json` when present (else the package's `extensions/` directory and `index.{ts,js,mjs}`), and scan those files' text for `.on("<event>"` / `.on('<event>'` with the three event names.
   - Bounds: at most 50 packages, at most 20 entry files per package, at most 512 KiB read per file. Missing or unreadable paths are skipped and noted in the result, never thrown.
   - `export function buildContextHookExtensionDoctorCheck({ projectRoot, agentDir, config })` → a doctor check object (`label: "pi extensions rewriting reviewer context"`). It is always `ok: true`. Add `warning: true` only when hooks are found **and** `config.agents.reviewer.loadUserExtensions === true`. The detail names each package and its hooks. The `suggestedCommand` is `spine settings set agents.reviewer.loadUserExtensions false`. When reviewers are isolated, the detail says so (for example `2 package(s) register context hooks; reviewers isolated (pi -ne)`).
2. **Wire** (`src/doctor/run-doctor-checks.mjs`): push the new check right after `buildPiExtensionConflictDoctorCheck`, passing the resolved config the other checks use.
3. **Tests** — new `tests/doctor/pi-extension-hooks.test.mjs` with a temp `agentDir` and fixture packages:
   - a package with `pi.extensions: ["./src/ext.ts"]` whose file contains `pi.on("context", …)` → found with hook `context`;
   - a package with `before_provider_request` in `extensions/index.js` (no manifest) → found;
   - a package with only `pi.on("tool_call", …)` → not found;
   - missing package dir → skipped, no throw;
   - check object: hooks found + `loadUserExtensions: true` → `warning: true`; hooks found + default config → `ok: true` and no `warning`; no hooks → `ok: true`, no `warning`.

## Dependencies

- **Task:** SP-819 (adds `agents.reviewer.loadUserExtensions` and reviewer `-ne` default)

## Context to Read First

- GitHub #334 ("Where spine is fragile" item 5, "Proposed solution" item 5, acceptance criterion 5)
- `src/doctor/pi-extension-conflict.mjs`; `tests/doctor/extension-conflict.test.mjs`
- `src/doctor/run-doctor-checks.mjs` 320-360
- `node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` (events) and `docs/packages.md` (`pi` manifest)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset; never read the real `~/.pi` in tests (always pass a temp `agentDir`)

## File Scope

- `src/doctor/pi-extension-hooks.mjs`
- `src/doctor/run-doctor-checks.mjs`
- `tests/doctor/pi-extension-hooks.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/doctor/pi-extension-hooks.test.mjs tests/doctor/extension-conflict.test.mjs tests/doctor/quota-risk.test.mjs tests/doctor/duplicate-install.test.mjs tests/arch/import-cycles.test.mjs` |
| fileScopeMustChange | `src/doctor/pi-extension-hooks.mjs`, `src/doctor/run-doctor-checks.mjs`, `tests/doctor/pi-extension-hooks.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus context on `buildPiExtensionConflictDoctorCheck` and the doctor check assembly — record how config reaches checks
- [ ] `rg -n 'checks\.length|label:' tests/doctor tests/cli` — find tests that assert the doctor check count or order; add them to the Contract run (Amendments if outside File Scope)
- [ ] Dependencies satisfied (SP-819 key on `main`)

### Step 1: Scanner and check

- [ ] Bounded scanner
- [ ] Advisory check object

**Artifacts:**
- `src/doctor/pi-extension-hooks.mjs` (new)

### Step 2: Wire into doctor

- [ ] Push after the extension-conflict check

**Artifacts:**
- `src/doctor/run-doctor-checks.mjs` (modified)

### Step 3: Tests

- [ ] Fixture cases above

**Artifacts:**
- `tests/doctor/pi-extension-hooks.test.mjs` (new)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] `spine doctor` in the repo exits 0 and lists the new check (paste the line into Discoveries)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-825 documents the check)

**Check If Affected:**
- None

## Completion Criteria

- [ ] Doctor warns when a context-rewriting extension is installed and reviewers load user extensions
- [ ] The check is advisory only and never fails doctor or preflight

## Git Commit Convention

- `feat(SP-822): doctor check for context-rewriting pi extensions (#334)`

## Do NOT

- Spawn `pi` or call a model from doctor (the optional `--probe-reviewer` probe is deferred)
- Change `pi-extension-conflict.mjs` behavior (exporting an existing helper is fine)
- Read the operator's real `~/.pi` from tests
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
