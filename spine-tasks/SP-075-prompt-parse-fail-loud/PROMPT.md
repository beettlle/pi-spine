# Task: SP-075 — Fail loud on PROMPT parse errors

**Created:** 2026-06-03
**Size:** S

## Review Level: 1 (Plan Only)

**Score:** 3/8

## Mission

Replace silent `catch { fileScopePaths = [] }` with fail-closed task failure + `task.prompt_parse_failed` journal event.

## Dependencies

- **None**

## File Scope

- `src/batch/engine.mjs`
- `src/batch/resume.mjs`
- `tests/batch/prompt-parse-fail.test.mjs` (new)

## Steps

### Step 1: Fail-closed handling
- [ ] engine.mjs + resume.mjs; `spine_review_step`

### Step 2: Testing & Verification
- [ ] Corrupt PROMPT test; FULL suite; coverage ≥77%

## Git Commit Convention
- `feat(SP-075): complete Step N — description`

---

## Amendments (Added During Execution)
