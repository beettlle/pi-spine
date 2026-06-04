# SP-093: Cursor rules CLI — Status

**Current Step:** 4
**Status:** ✅ Complete
**Last Updated:** 2026-06-04
**Review Level:** 1
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-091 complete (`selectRulesForWorker` + glob match landed)

### Step 1: spine rules commands
**Status:** ✅ Complete

- [x] `discover [--json]`, `select --task`, `sync`
- [x] `spine_review_step` after step

### Step 2: Init + doctor
**Status:** ✅ Complete

- [x] init copies profile; discover; `standards: []` default
- [x] doctor RULES_MANIFEST_MISSING / STALE
- [x] manifest not gitignored

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] CLI tests + coverage ≥77% (500 pass; line coverage 83.84%)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] `spine rules --help`
- [x] Discoveries logged in STATUS.md

## Discoveries

| # | Finding | Impact |
|---|---------|--------|
| 1 | `spine rules discover|sync` call `discoverCursorRules({ writeManifest: true })`; `select --task` loads PROMPT File Scope + `selectRulesForWorker` (requires manifest). | SP-092 worker path mirrors `spine rules select`. |
| 2 | `spine init` copies `templates/rules-profile.json`, runs discovery, sets `standards: []` (no `DEFAULT_SPINE_INIT_STANDARDS` merge). Non-empty `standards` still append per SP-091. | Supersedes SP-073 init seeding test. |
| 3 | Doctor checks run when `.cursor/rules` or `.spine/rules-profile.json` exists; warnings use codes `RULES_MANIFEST_MISSING` / `RULES_MANIFEST_STALE` with `spine rules sync`. | Advisory only (`warning: true`). |
| 4 | `fingerprintRulesManifest` compares manifest content ignoring `generatedAt` for stale detection. | `spine rules sync` refreshes committed manifest. |
| 5 | `runDoctorChecks` moved to `bin/spine-doctor.mjs`; `bin/spine.mjs` re-exports for preflight/tests. | Stable import path for `runDoctorChecks`. |
