# SP-090: Cursor rules discover + manifest — Status

**Current Step:** 4
**Status:** ✅ Complete
**Last Updated:** 2026-06-04
**Review Level:** 2
**Review Counter:** 2
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-089 available on branch
- [x] `.cursor/rules/` present (38 rule files)

### Step 1: Discovery engine
**Status:** ✅ Complete

- [x] `discoverCursorRules` implemented
- [x] Plan review APPROVE

### Step 2: Init template + pi-spine manifest
**Status:** ✅ Complete

- [x] Template profile + committed manifest
- [x] Code review APPROVE

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Tests + coverage ≥77% (475 pass; line coverage 83.81%)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged

---

## Discoveries

| # | Finding | Impact |
|---|---------|--------|
| 1 | `discoverCursorRules({ projectRoot, profile?, writeManifest? })` → `{ ok: true, manifest, manifestPath? }`. Scans `.cursor/rules/**/*.{mdc,md}`; caps 200 files / 512 KiB per file; posix `relPath`. | SP-091/092/093 call discover or read manifest. |
| 2 | Manifest schema: `{ generatedAt, rulesRoot, rules[], excluded[], warnings? }`. `rules[]` entries: `relPath`, `spineClass` (`always`\|`glob`\|`manual`), `alwaysApply`, `description`, `globs`, `parseStatus`, optional `warnings`. `excluded[]`: `relPath`, `reason` (`excludePattern`\|`excludeRelPath`), `spineClass: "excluded"`. | SP-091 selection consumes `rules[]`; doctor checks `generatedAt` (SP-093). |
| 3 | `spineClass`: `alwaysApply` → `always`; non-empty `globs` → `glob`; else `manual`. Excluded files never appear in `rules[]`. | SP-091 ordering uses spineClass + profile `alwaysInclude`. |
| 4 | `getCursorRuleExclusionReason` matches `excludeRelPaths` exactly and `excludePatterns` via micromatch on relPath, basename, and stem (so `*-brutal-audit` matches `rust-brutal-audit.mdc`). | Profile patterns need not include `.mdc` suffix. |
| 5 | `writeRulesManifestAtomic` / `loadRulesManifest`; `RULES_MANIFEST_REL_PATH` = `.spine/rules-manifest.json` (not gitignored). pi-spine manifest: 27 rules, 11 excluded. | SP-093 `spine rules sync`; init copies `templates/rules-profile.json`. |
| 6 | `templates/rules-profile.json` mirrors `DEFAULT_RULES_PROFILE` for `spine init`. | SP-093 init copies profile then runs discover. |
