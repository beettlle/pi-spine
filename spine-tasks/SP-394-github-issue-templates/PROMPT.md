# Task: SP-394 — GitHub issue templates

**Created:** 2026-06-30
**Size:** S

## Review Level: 0 (None)

**Assessment:** Repo-only YAML templates; no application code.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Implement **GitHub issue #60** Tier 1a: add `.github/ISSUE_TEMPLATE/` so new issues auto-apply labels and match the operator upstream bug checklist structure.

**Required files:**

1. `config.yml` — disable blank issues; link to docs
2. `bug_report.yml` — default label `bug`; fields: Summary, Environment, Steps, Diagnosis, Journal excerpt, Expected, Actual
3. `feature_request.yml` — default label `enhancement`; fields: Summary, Motivation, Proposed solution, Alternatives

**Closes:** partial #60 (templates only; CLI in SP-396)

## Dependencies

None

## Context to Read First

- GitHub issue #60
- `.cursor/rules/spine-operator-cursor.mdc` — Upstream bug reports checklist
- `spine-tasks/CONTEXT.md` Phase 48

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| artifactsMustExist | `.github/ISSUE_TEMPLATE/config.yml,.github/ISSUE_TEMPLATE/bug_report.yml,.github/ISSUE_TEMPLATE/feature_request.yml` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #60 template requirements
- [ ] Read operator rule upstream bug checklist fields

### Step 1: Issue templates

- [ ] Add `config.yml` with `blank_issues_enabled: false`
- [ ] Add `bug_report.yml` with label `bug` and checklist-aligned body sections
- [ ] Add `feature_request.yml` with label `enhancement`

### Step 2: Testing & Verification

- [ ] Validate YAML parses (`node -e` or manual review)
- [ ] Confirm template field names match operator checklist (Summary, Environment, Diagnosis, etc.)

### Step 3: Documentation & Delivery

- [ ] Note in STATUS that SP-397 will cross-link templates from runbook

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All three template files exist and apply correct default labels
- [ ] Blank issues disabled

## Git Commit Convention

- `feat(SP-394): complete Step N — description`
- `docs(SP-394): description`

## Do NOT

- Add application code or CLI in this task
- Close GitHub issue #60 (SP-397 closes after full epic)

---

## Amendments (Added During Execution)
