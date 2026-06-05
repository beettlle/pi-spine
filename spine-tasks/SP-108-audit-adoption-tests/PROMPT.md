# Task: SP-108 — Brutal audit: adoption, docs & test quality

**Created:** 2026-06-05
**Size:** M

## Review Level: 0 (None)

**Assessment:** Read-only audit of test suite quality, CI, adoption docs, agent templates, and operator UX. Report only.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Conduct a **brutal audit** of pi-spine adoption path, documentation accuracy, CI enforcement, agent template drift, and test suite effectiveness. Apply `.cursor/rules/javascript-3-brutal-audit.mdc` Sections F, X. Produce `AUDIT-REPORT.md`.

**Do not fix code** — audit and report only.

## Dependencies

- **None**

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md` — Phase 9 adoption, Phase 12 coverage policy

**Tier 3:**
- `docs/adoption/operator-runbook.md`
- `docs/adoption/bootstrap-checklist.md`
- `.cursor/rules/javascript-3-brutal-audit.mdc` Sections F, X

## File Scope

- `tests/integration/**`
- `tests/adoption/**`
- `tests/incidents/**`
- `tests/lanes-parallel/**`
- `tests/fixtures/**` (excluding `tests/fixtures/incidents/**`)
- `.github/**`
- `docs/**`
- `templates/**`
- `extensions/**`
- `skills/**`

## Steps

### Step 0: Preflight

- [ ] Run full suite + coverage gate (record counts and line %)
- [ ] Read operator runbook + bootstrap checklist

### Step 1: Deep adoption & test audit

- [ ] Doc drift, CI gaps, agent template drift, test quality, adoption friction, integration fixtures

### Step 2: Write AUDIT-REPORT.md

- [ ] Executive summary + cleanliness score /10
- [ ] Severity-rated findings + coverage holes + doc drift inventory
- [ ] Recommended remediation tasks (`SP-1xx`)

### Step 3: Documentation & Delivery

- [ ] STATUS.md complete
- [ ] Create `.DONE`

## Completion Criteria

- [ ] AUDIT-REPORT.md with ≥5 substantive findings
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-108): adoption and test quality brutal audit report`

## Do NOT

- Modify production code or docs (audit-only)
- Re-audit `tests/batch/**` (SP-106 scope)

---

## Amendments (Added During Execution)
