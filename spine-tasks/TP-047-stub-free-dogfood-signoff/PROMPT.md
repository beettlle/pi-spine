# Task: TP-047 — Stub-free dogfood sign-off

**Created:** 2026-06-02
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** 2/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Close the **Phase 6 manual checklist** gap: document and execute stub-free validation (`SPINE_WORKER_STUB=0`, real `pi` on PATH).

Deliverables:
1. **`docs/compatibility/stub-free-dogfood-report.md`** — date, commit, operator, checklist results
2. **`scripts/stub-free-dogfood.sh`** — guided manual run (preflight → plan → batch → land loop) with env checks
3. **Update `phase6-dogfood-report.md`** — check off manual items or link to stub-free report; remove stale deferrals (settings/deps done)
4. **Fix flaky tests** if blocking sign-off: `tests/worker-tools/review-step-tool.test.mjs`, `worker-tools-registration.test.mjs`

**Success:** Written sign-off that real-pi path was exercised on pi-spine repo (minimum: single-task batch) OR documented blockers with repro steps.

## Dependencies

- **TP-044** — adoption fixture available as optional smoke target

## Context to Read First

**Tier 3:** `docs/compatibility/phase6-dogfood-report.md`, `bin/spine-worker-runner.mjs`, README stub section

## File Scope

- `docs/compatibility/stub-free-dogfood-report.md` (new)
- `scripts/stub-free-dogfood.sh` (new)
- `docs/compatibility/phase6-dogfood-report.md`
- `tests/worker-tools/*.test.mjs` (if flaky fix needed)

## Steps

### Step 1: Prep script + checklist template

> **Plan-review checkpoint**

- [ ] stub-free-dogfood.sh validates pi, SPINE_WORKER_STUB unset
- [ ] Report template with pass/fail per manual item

### Step 2: Execute manual dogfood

- [ ] Run on pi-spine repo: single small scope (e.g. doc-only task or AD-001 in fixture)
- [ ] Record results in stub-free-dogfood-report.md

### Step 3: Update Phase 6 report + fix flakes

- [ ] phase6-dogfood-report.md cross-links and updated deferrals
- [ ] Stabilize worker-tools tests if failing in CI

### Step 4: Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — record count in STATUS

## Completion Criteria

- [ ] stub-free-dogfood-report.md signed
- [ ] Phase 6 manual section updated
- [ ] Test suite green

## Do NOT

- Do not require stub-free tests in default CI (keep SPINE_WORKER_STUB=1 for npm test)

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-043): local install doctor check`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
