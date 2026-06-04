# Task: SP-091 — Cursor rules selection + glob match

**Created:** 2026-06-04
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** `selectRulesForWorker()` with micromatch against PROMPT File Scope; ordering and caps before injection.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement `ruleGlobsMatchFileScope()`, `expandFileScopeProbes()`, `selectRulesForWorker()`, and stable `priorityRank()` ordering. Enforce: **`config.standards` appends** to auto-selected paths (deduped); **`taskplane-worker-cursor.mdc` included** via profile defaults; respect `neverLoad` and caps.

## Dependencies

- **Task:** SP-090 (manifest + discover)

## Context to Read First

- `src/tasks/packet/parse-prompt.mjs`
- `.spine/rules-manifest.json`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/cursor-rules/match-globs.mjs`
- `src/config/cursor-rules/priority.mjs`
- `src/config/cursor-rules/select.mjs`
- `src/config/cursor-rules/index.mjs`
- `tests/config/cursor-rules/match-globs.test.mjs`
- `tests/config/cursor-rules/select.test.mjs`

## Steps

### Step 0: Preflight

- [ ] SP-090 manifest available
- [ ] Confirm `micromatch` import works

### Step 1: Glob matching
> **Plan-review checkpoint**

- [ ] `expandFileScopeProbes(fileScope)` for `dir/*`, `dir/**`, literals; synthetic extension probes
- [ ] `ruleGlobsMatchFileScope(globs, fileScope)` via **micromatch**; `**/*` matches when fileScope non-empty
- [ ] Empty fileScope → no glob-triggered rules
- [ ] `spine_review_step` after step

### Step 2: Selection + append semantics
> **Code review checkpoint**

- [ ] `selectRulesForWorker` — alwaysInclude → always class → glob matches → **append** `config.standards[]` → minus neverLoad/neverInclude
- [ ] Tests: JS scope, Swift negative, OWASP on bin/*.mjs, append dedupe
- [ ] `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] FULL suite + `npm run coverage:check` ≥77%

### Step 4: Documentation & Delivery

- [ ] Export selection shape for SP-092 journal event
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `src/config/worker-context.mjs` — read only until SP-092

## Completion Criteria

- [ ] All steps complete
- [ ] `selectRulesForWorker` and glob match tests pass
- [ ] Append `config.standards` semantics verified in tests
- [ ] Full test suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-091): complete Step N — description`

## Do NOT

- Change worker-runner (SP-092)
- Add CLI (SP-093)

---

## Amendments (Added During Execution)
