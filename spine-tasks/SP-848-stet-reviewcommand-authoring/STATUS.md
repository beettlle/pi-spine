# SP-848: Authoring guidance: stet in reviewCommand, strictness by size — Status

**Current Step:** Step 0
**Status:** 🔵 Not Started
**Last Updated:** 2026-11-01
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read both files; note every Contract table and example that would need a `reviewCommand` row

### Step 1: Contract template
**Status:** ⬜ Not Started

- [ ] `reviewCommand` field row and code-task example
- [ ] Semantics: once, after passing `testCommand`, no retries, `contract.reviewTimeoutMs`, `contract.reviewPolicy`
- [ ] Omit for docs-only and `Type: execute`

### Step 2: Strictness and threshold guidance
**Status:** ⬜ Not Started

- [ ] Strictness by size in both files
- [ ] Threshold note (`warning` / 0.8, env overrides) in both files

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

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

## Blockers

*None*
