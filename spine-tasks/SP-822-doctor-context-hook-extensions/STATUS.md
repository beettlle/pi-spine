# SP-822: Doctor warns about context-rewriting pi extensions — Status

**Current Step:** Step 5: Documentation & Delivery
**Status:** ✅ Complete (re-verified after code-review REVISE round)
**Last Updated:** 2026-10-14
**Review Level:** 1
**Review Counter:** 1
**Iteration:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Config flow into doctor checks recorded — `runDoctorChecks` calls `loadSpineConfig(projectRoot)`; the extension-conflict check at ~347 sits before the original load point, so the load moved earlier (single load) and the new check is pushed immediately after with `configResult.config`. New check reads `config.agents?.reviewer?.loadUserExtensions` (registered SP-819 setting; schema validates it as boolean).
- [x] Count/order tests listed — only `tests/cli/phase23-exit-verify.test.mjs:100` asserts count (`checks.length >= 5`, lower bound — safe, no change needed; outside File Scope). All other doctor tests use `.find()` by label/id; no order assertions found.
- [x] Dependencies satisfied — SP-819 landed on main (95d3ac9d); extension-conflict module (`src/doctor/pi-extension-conflict.mjs`) provides reusable `resolvePiAgentDir`, `readPiPackageSources`, `resolvePiPackageSourcePath`.

### Step 1: Scanner and check
**Status:** ✅ Complete (revised)

- [x] Bounded scanner — `src/doctor/pi-extension-hooks.mjs`: `findContextRewritingExtensions` scans only settings-declared packages (`agentDir/settings.json` + `projectRoot/.pi/settings.json`, cap 50 packages), only `package.json` → `pi.extensions` entries when present, else the conventional `extensions/` dir + root `index.{ts,js,mjs}` fallback pi discovers (cap 20 entries/package), only first 512KiB per entry file.
- [x] Hook patterns match the `.on("<event>"` / `.on('<event>'` call shape per PROMPT (`context`, `context_with_system`, `before_provider_request`).
- [x] Advisory check — `buildContextHookExtensionDoctorCheck` (label `pi extensions rewriting reviewer context`): always `ok: true`; `warning: true` + `suggestedCommand: spine settings set agents.reviewer.loadUserExtensions false` only when hooks found **and** `config.agents.reviewer.loadUserExtensions === true`; otherwise detail reports `N package(s) register context hooks (...); reviewers isolated (pi -ne)`.

**Revision (code review REVISE, 2026-10-14):** the first iteration invented a `reviewers.piExtensionIsolation` config key and skipped the manifest-less fallback scan; both corrected to the PROMPT contract (`agents.reviewer.loadUserExtensions`, `extensions/` + `index.{ts,js,mjs}` fallback), and the missing no-manifest `before_provider_request` test case was added.

### Step 2: Wire into doctor
**Status:** ✅ Complete (revised)

- [x] Check pushed — `run-doctor-checks.mjs` loads spine config once before the extension-conflict check and pushes `buildContextHookExtensionDoctorCheck({ projectRoot, config: configResult.config })` immediately after `buildPiExtensionConflictDoctorCheck` (per Mission item 2); advisory, no issueCount increment.

### Step 3: Tests
**Status:** ✅ Complete (revised)

- [x] Fixture cases — 18 tests: `.on("<event>")` hook detection (single/double quotes, whitespace), non-hook identifier guard, canonical order, manifest `pi.extensions` entry with `pi.on("context", …)`, no-manifest fallback `extensions/index.js` with `before_provider_request`, root `index.mjs` fallback, tool_call-only package not flagged, missing package dir skipped (noted, no throw), project settings + dedupe, entry cap (20), package cap (50), 512KiB truncation, path-traversal guard, warn (`loadUserExtensions: true`) / isolated / clean check states, `runDoctorChecks` integration asserting position right after the extension-conflict check via `PI_AGENT_DIR` env. All pass.

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint — `eslint --max-warnings 0` green.
- [x] Contract `testCommand` — green end-to-end after revision: lint + typecheck + scoped runner (78 tests: pi-extension-hooks, extension-conflict, quota-risk, duplicate-install, import-cycles) exit 0 + `spine-stet-contract-run.sh lenient SP-822` exit 0 with 0 active findings.
- [x] `spine doctor` lists the check — `✅ pi extensions rewriting reviewer context (1 package(s) register context hooks (../../Documents/github/pi-headroom (context)); reviewers isolated (pi -ne))` on this machine, pushed right after `pi-web-access extension conflict`.
- [x] Fix all failures — stet triaged: 7ac810c fixed (bounded open-time read), b1e2e5d dismissed false_positive (import used at run-doctor-checks.mjs:498), 05e6e86 dismissed false_positive (node:test per-file process isolation; Date.now axis hardened to mkdtemp), 0f88739 fixed (package-dir containment check + regression test) then dismissed already_correct.

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `runDoctorChecks` upstream impact is HIGH (batch preflight, CLI, issue-draft) — mitigated by additive-only change: one advisory check pushed, no existing check/return shape/control flow touched. |
| 2 | pi packages declare extension entries in `package.json` → `pi.extensions` (array of entry files); pi loads only `settings.json` `packages` entries, so settings-driven scanning is complete and bounded. |
| 3 | Count/order test survey: only `tests/cli/phase23-exit-verify.test.mjs:100` asserts count (`checks.length >= 5`, lower bound — safe); all doctor tests use `.find()` by label/id; no changes needed outside File Scope. |
| 4 | Config key is `agents.reviewer.loadUserExtensions` (SP-819), schema-validated as a boolean on `agents.reviewer` and per-profile reviewers — doctor warns only on explicit `=== true`; default and `false` both take the isolated `(pi -ne)` path. |
| 5 | Pi discovers extensions for manifest-less packages from conventional locations: `extensions/` dir files plus root `index.{ts,js,mjs}` — the scanner must cover both paths or it silently misses packages without a `pi.extensions` list (code-review REVISE finding 2). |
| 6 | Full `npm test` has 54 failures that pre-exist the lane: verified identical on base 95d3ac9d via temp worktree (tests/spine-run.test.mjs 2/2 fail on base; batch-start-superseded-guard + adoption fixture 3/9 fail on both base and lane). Subprocess-heavy integration tests; Contract's scoped run is this S task's gate per packet amendment. |
| 7 | Stet re-reviews the cumulative task diff; a fixed finding can persist in the store referencing the pre-fix hunk — dismiss with `already_correct` after the fix commit (0f88739 → containment check + `skips entries escaping the package directory` test). Post-revision stet run: 0 findings. |

## Blockers

_None._
