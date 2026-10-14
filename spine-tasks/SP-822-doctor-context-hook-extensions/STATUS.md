# SP-822: Doctor warns about context-rewriting pi extensions — Status

**Current Step:** Step 0: Preflight
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-10-10
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
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] `spine doctor` lists the check
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `runDoctorChecks` upstream impact is HIGH (batch preflight, CLI, issue-draft) — mitigated by additive-only change: one advisory check pushed, no existing check/return shape/control flow touched. |
| 2 | pi packages declare extension entries in `package.json` → `pi.extensions` (array of entry files); pi loads only `settings.json` `packages` entries, so settings-driven scanning is complete and bounded. |
| 3 | Count/order test survey: only `tests/cli/phase23-exit-verify.test.mjs:100` asserts count (`checks.length >= 5`, lower bound — safe); all doctor tests use `.find()` by label/id; no changes needed outside File Scope. |
| 4 | Config key `reviewers.piExtensionIsolation` needs no schema change — config validation is field-scoped, unknown keys pass through. |

## Blockers

_None._
