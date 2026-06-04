# SP-091: Cursor rules selection + glob match — Status

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

- [x] SP-090 manifest available (`.spine/rules-manifest.json`, 27 rules)
- [x] Confirm `micromatch` import works (`npm install`, smoke test)

### Step 1: Glob matching
**Status:** ✅ Complete

- [x] `expandFileScopeProbes(fileScope)` for `dir/*`, `dir/**`, literals; synthetic extension probes
- [x] `ruleGlobsMatchFileScope(globs, fileScope)` via **micromatch**; `**/*` matches when fileScope non-empty
- [x] Empty fileScope → no glob-triggered rules
- [x] `spine_review_step` after step (stub APPROVE)

### Step 2: Selection + append semantics
**Status:** ✅ Complete

- [x] `selectRulesForWorker` — alwaysInclude → always class → glob matches → **append** `config.standards[]` → minus neverLoad/neverInclude
- [x] Tests: JS scope, Swift negative, OWASP on bin/*.mjs, append dedupe
- [x] `spine_review_step` after step (stub APPROVE)

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] FULL suite + `npm run coverage:check` ≥77% (490 pass; line coverage 84.00%)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Export selection shape for SP-092 journal event
- [x] Discoveries logged in STATUS.md

## Discoveries

| # | Finding | Impact |
|---|---------|--------|
| 1 | `selectRulesForWorker({ manifest, profile, fileScope, standards, neverLoad, maxRules })` → `{ ok, paths, entries, capped, dropped?, globMatchEnabled, fileScopeProbeCount }`. Each `entries[]` item: `{ relPath, contextPath, source, spineClass? }` with `source` ∈ `alwaysInclude` \| `always` \| `glob` \| `standards`. | SP-092 `worker.rules_selected` journal and `buildWorkerContextAsync` consume `paths` / `entries`. |
| 2 | `ruleGlobsMatchFileScope` matches rule globs against **probes** (`expandFileScopeProbes`) and **raw** file-scope entries (so `bin/*.mjs` matches `**/*.mjs` / `bin/**`). Empty fileScope → no glob-triggered rules; `**/*` matches any non-empty scope. | PROMPT File Scope globs and directory patterns behave like Cursor rule globs. |
| 3 | `DEFAULT_SELECT_MAX_RULES = 48`; lower-priority paths land in `dropped` when capped. Path helpers: `ruleRelPathToContextPath`, `contextPathToRuleRelPath`. | SP-092 may apply byte cap after count cap. |
| 4 | `config.standards` **appends** after auto-selection (deduped by relPath); existing glob/always paths keep their source tag. `neverLoad` and profile `neverInclude` block both rel and context paths. | Locked product decision from CONTEXT.md. |
| 5 | Exported from `src/config/cursor-rules/index.mjs`: match, priority, select APIs. | SP-093 `spine rules select` imports from index. |
