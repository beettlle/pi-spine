# SP-848: Authoring guidance: stet in reviewCommand, strictness by size — Status

**Current Step:** Step 3
**Status:** 🔵 Not Started
**Last Updated:** 2026-11-01
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read both files; note every Contract table and example that would need a `reviewCommand` row

### Step 1: Contract template
**Status:** ✅ Complete

- [x] `reviewCommand` field row and code-task example
- [x] Semantics: once, after passing `testCommand`, no retries, `contract.reviewTimeoutMs`, `contract.reviewPolicy`
- [x] Omit for docs-only and `Type: execute`

### Step 2: Strictness and threshold guidance
**Status:** ✅ Complete

- [x] Strictness by size in both files
- [x] Threshold note (`warning` / 0.8, env overrides) in both files

### Step 3: Testing & Verification
**Status:** 🔄 In Progress

- [ ] `rg -l 'contract-template.md|spine-task-authoring.mdc' tests/` and run only the hits with `node --experimental-strip-types --test --test-reporter=dot <files>` (none → note "no tests reference these docs")
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-848-stet-reviewcommand-authoring/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |
| 2026-11-02 | Step 0 preflight | Template field table lacks `reviewCommand` row; authoring rule example (L106) + SP-845 bullet (L114) already exist; `scripts/spine-stet-contract-run.sh` accepts `lenient\|default\|strict` + task-id; env overrides `SPINE_STET_MIN_SEVERITY`/`SPINE_STET_MIN_CONFIDENCE` confirmed in src (SP-846); `reviewCommand` is a known contract field (`src/tasks/packet/parse-prompt.mjs`) |
| 2026-11-02 | Step 1 complete | `reviewCommand` row added to contract-template field table + `validate-prompt` code-task example; semantics (once, after test pass, no retry, `contract.reviewTimeoutMs`/`reviewPolicy`, no stet chaining, omit for docs-only/execute) in the row |
| 2026-11-02 | Step 2 complete | Strictness-by-size + `warning`/0.8 threshold note added to SP-845 bullet in authoring rule (a414cc26 already covers the template) |

## Blockers

*None*
