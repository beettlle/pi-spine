# Task: SP-081 — Commit .cursor/rules for contributors

**Created:** 2026-06-03
**Size:** S

## Review Level: 0 (None)

**Score:** 1/8

## Mission

Add `.cursor/rules/` to git (currently untracked). Document in README and bootstrap checklist which rules apply to pi-spine (JS/CLI subset). Exclude secrets; no vendoring of unrelated language rules into worker prompts yet (SP-073 handles wiring).

## Dependencies

- **None**

## File Scope

- `.cursor/rules/**`
- `README.md`
- `docs/adoption/bootstrap-checklist.md`

## Steps

### Step 1: Curate and commit rules
- [ ] Stage `.cursor/rules/` (JS-relevant + universal rules; document optional language packs)
- [ ] Verify no secrets or machine-local paths in rules

### Step 2: Contributor docs
- [ ] README section: Cursor rules + audit workflow pointer
- [ ] Bootstrap checklist: optional `.cursor/` setup step

### Step 3: Verification
- [ ] `git status` clean after commit on branch; no .gitignore conflict

## Do NOT
- Duplicate full rule text into docs/ (link to `.cursor/rules/`)

---

## Amendments (Added During Execution)
