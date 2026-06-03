# Task: SP-080 — CI doctor enforce + PR template

**Created:** 2026-06-03
**Size:** S

## Review Level: 0 (None)

**Score:** 1/8

## Mission

Fix CI fail-open on `spine doctor || true`. Add `.github/pull_request_template.md` per git-workflow rules. CI fixture runs `spine init` then asserts doctor passes.

## Dependencies

- **None**

## File Scope

- `.github/workflows/ci.yml`
- `.github/pull_request_template.md` (new)

## Steps

### Step 1: CI doctor gate
- [ ] Init fixture project in CI job; doctor must pass (no `|| true`)

### Step 2: PR template
- [ ] Summary + test plan checklist per git-workflow-and-pr.mdc

### Step 3: Verification
- [ ] CI workflow syntax valid; local `npm test` still passes

## Do NOT
- Change unrelated workflow jobs

---

## Amendments (Added During Execution)
