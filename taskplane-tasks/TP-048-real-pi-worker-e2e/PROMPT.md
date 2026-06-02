# Task: TP-048 — Real pi worker + reviewer E2E

**Created:** 2026-06-02
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** 3/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Validate **real pi workers and reviewers** end-to-end on adoption fixture or dedicated smoke task — beyond stub dogfood.

Deliverables:
1. **Smoke task** — `AD-002-real-pi-smoke` in adoption fixture (or pi-spine TP-SMOKE): Review Level 1, one implementation step, verifies worker can call `spine_report_progress` / complete step
2. **Runbook section** in stub-free report or new `docs/adoption/real-pi-e2e.md`: model config, expected duration, failure recovery
3. **Evidence** — journal tail snippet, `.DONE`, lane branch commit hash in report
4. **Worker template check** — confirm `templates/agents/worker.md` references MCP tools (not only shell spine CLI)

**Success:** One real-pi batch completes AD-002 with review step executed (not `--stub`).

## Dependencies

- **TP-047** — stub-free infrastructure and test stability

## Context to Read First

**Tier 3:** `templates/agents/worker.md`, `src/batch/review.mjs`, TP-037/038 worker tools

## File Scope

- `tests/fixtures/adoption-repo/taskplane-tasks/AD-002-real-pi-smoke/` (new)
- `docs/adoption/real-pi-e2e.md` (new)
- `templates/agents/worker.md` (verify/update)
- `docs/compatibility/stub-free-dogfood-report.md`

## Steps

### Step 1: Smoke task packet

> **Plan-review checkpoint**

- [ ] AD-002 PROMPT/STATUS — trivial verifiable change in fixture
- [ ] Review Level 1 so reviewer path exercised

### Step 2: Real-pi batch execution

- [ ] SPINE_WORKER_STUB=0 batch on fixture copy
- [ ] Capture evidence in real-pi-e2e.md

### Step 3: Worker template + verification

- [ ] Worker template documents spine_* tools
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Completion Criteria

- [ ] Real-pi batch completed with evidence
- [ ] real-pi-e2e.md published

## Do NOT

- Do not add real-pi to default npm test (manual/optional script only)

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-043): local install doctor check`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
