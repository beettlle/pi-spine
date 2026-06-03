# Task: TP-044 — Adoption fixture repo + bootstrap checklist

**Created:** 2026-06-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Create a **minimal consumer-project fixture** and bootstrap checklist so adoption can be tested without touching a production repo.

Deliverables:
1. **`tests/fixtures/adoption-repo/`** — tiny git repo layout: `.pi/spine-config.json`, `taskplane-tasks/AD-001-smoke/` with trivial PROMPT (Review Level 0, one step: touch `DONE.txt`)
2. **`docs/adoption/bootstrap-checklist.md`** — step-by-step for greenfield + migrate-from-taskplane
3. **Integration test** — `tests/adoption/fixture-batch.test.mjs`: copy fixture to temp dir, `spine init` skip if pre-inited, `SPINE_WORKER_STUB=1 spine plan`, stub batch start AD-001, assert `.DONE`
4. **Script** — `scripts/adoption-smoke.sh` wrapping fixture test for operators

**Success:** CI proves stub batch completes in fixture; checklist is copy-paste ready for real projects.

## Dependencies

- **TP-043** — local install doc informs fixture setup notes

## Context to Read First

**Tier 3:** `tests/batch/integration-abc.test.mjs`, `spine init` templates, `docs/adoption/real-project-readiness.md`

## File Scope

- `tests/fixtures/adoption-repo/**` (new)
- `docs/adoption/bootstrap-checklist.md` (new)
- `tests/adoption/fixture-batch.test.mjs` (new)
- `scripts/adoption-smoke.sh` (new)

## Steps

### Step 1: Fixture layout

> **Plan-review checkpoint**

- [ ] Create adoption-repo fixture with AD-001 smoke task
- [ ] Document fixture purpose in bootstrap-checklist intro

### Step 2: Bootstrap checklist

- [ ] Write checklist: prerequisites, install, init/migrate, doctor, first batch

### Step 3: Integration test + script

> **Code review checkpoint**

- [ ] fixture-batch.test.mjs runs stub batch end-to-end in temp copy
- [ ] adoption-smoke.sh invokes test or documents manual steps

### Step 4: Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Completion Criteria

- [ ] Fixture + test green
- [ ] Bootstrap checklist published

## Must Update

- `docs/adoption/real-project-readiness.md`

## Do NOT

- Do not require network or real pi in CI test
- Do not add large sample apps — keep fixture minimal

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-043): local install doctor check`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
