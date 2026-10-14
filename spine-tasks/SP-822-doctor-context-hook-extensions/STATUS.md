# SP-822: Doctor warns about context-rewriting pi extensions — Status

**Current Step:** Step 5: Documentation & Delivery
**Status:** ✅ Complete
**Last Updated:** 2026-10-14
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Config flow into doctor checks recorded — `runDoctorChecks` calls `loadSpineConfig(projectRoot)`; config-driven checks are pushed inside the valid-config branch (`configResult.config` passed to builders). New check reads `config.reviewers?.piExtensionIsolation`; schema is field-scoped (unknown keys pass through), so no schema change needed.
- [x] Count/order tests listed — only `tests/cli/phase23-exit-verify.test.mjs:100` asserts count (`checks.length >= 5`, lower bound — safe, no change needed; outside File Scope). All other doctor tests use `.find()` by label/id; no order assertions found.
- [x] Dependencies satisfied — SP-819 landed on main (95d3ac9d); extension-conflict module (`src/doctor/pi-extension-conflict.mjs`) provides reusable `resolvePiAgentDir`, `readPiPackageSources`, `resolvePiPackageSourcePath`.

### Step 1: Scanner and check
**Status:** ✅ Complete

- [x] Bounded scanner — `src/doctor/pi-extension-hooks.mjs`: scans only settings-declared packages (`agentDir/settings.json` + `projectRoot/.pi/settings.json`), only `package.json` → `pi.extensions` entries (cap 16/package), only first 512KB per entry file.
- [x] Advisory check — `buildPiContextHookDoctorCheck`: always `ok: true`; `warning: true` + `suggestedCommand` when hooks found and `reviewers.piExtensionIsolation` ≠ `trusted`; trusted config downgrades to plain detail.

### Step 2: Wire into doctor
**Status:** ✅ Complete

- [x] Check pushed — `run-doctor-checks.mjs` pushes the check inside the valid-config branch after the SP-710 evidence-warn loop; advisory, no issueCount increment.

### Step 3: Tests
**Status:** ✅ Complete

- [x] Fixture cases — 14 tests: hook patterns (incl. false-positive guard on non-exported `context`), canonical order, npm + project settings discovery, dedupe, package without `pi.extensions`, entry cap, 512KB truncation, warn/trusted/clean check states, `runDoctorChecks` integration via `PI_AGENT_DIR` env. All pass.

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint — `eslint --max-warnings 0` green.
- [x] Contract `testCommand` — green end-to-end: lint + typecheck + scoped runner (75 tests: pi-extension-hooks, extension-conflict, quota-risk, duplicate-install, import-cycles) exit 0 + `spine-stet-contract-run.sh lenient SP-822` exit 0 with 0 active findings.
- [x] `spine doctor` lists the check — `✅ pi context-rewriting extension hooks (no context-rewriting hooks found in 8 installed pi package(s))` on this machine.
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
| 4 | Config key `reviewers.piExtensionIsolation` needs no schema change — config validation is field-scoped, unknown keys pass through. |
| 5 | Full `npm test` has 54 failures that pre-exist the lane: verified identical on base 95d3ac9d via temp worktree (tests/spine-run.test.mjs 2/2 fail on base; batch-start-superseded-guard + adoption fixture 3/9 fail on both base and lane). Subprocess-heavy integration tests; Contract's scoped run is this S task's gate per packet amendment. |
| 6 | Stet re-reviews the cumulative task diff; a fixed finding can persist in the store referencing the pre-fix hunk — dismiss with `already_correct` after the fix commit (0f88739 → containment check at pi-extension-hooks.mjs:174 + `skips entries escaping the package directory` test). |

## Blockers

_None._
