# SP-394: GitHub issue templates — Status

**Current Step:** Complete
**Status:** 🟢 Complete
**Last Updated:** 2026-06-30
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read GitHub issue #60 template requirements
- [x] Read operator rule upstream bug checklist fields

---

### Step 1: Issue templates
**Status:** ✅ Complete

- [x] Add `config.yml` with `blank_issues_enabled: false`
- [x] Add `bug_report.yml` with label `bug` and checklist-aligned body sections
- [x] Add `feature_request.yml` with label `enhancement`

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Validate YAML parses (Ruby `YAML.load_file` on all three files)
- [x] Confirm template field names match operator checklist (Summary, Environment, Steps, Diagnosis, Journal excerpt, Expected, Actual)

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Note in STATUS that SP-397 will cross-link templates from runbook

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-30 | Step 0–1 | Read #60 + operator checklist; added three ISSUE_TEMPLATE files |
| 2026-06-30 | Step 2–3 | YAML validated; contract `true` + artifacts OK |

---

## Blockers

*None*

---

## Notes

- SP-397 will cross-link these templates from the operator runbook and update `spine-operator-cursor.mdc` label guidance.
- `config.yml` links to operator runbook and upstream bug triage rule.
- Bug template fields align with operator checklist: version/doctor under Environment, commands under Steps, diagnose under Diagnosis.
