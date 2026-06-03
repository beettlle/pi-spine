# Task: SP-070 — Journal attach test isolation

**Created:** 2026-06-03
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Hardens batch journal attach so worker `npm test` and unit tests cannot pollute live batch journals; fixes global `SPINE_REVIEW_STUB_FAIL` coupling.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Stop **journal attach pollution**: when workers run verification (`npm test`) with inherited `SPINE_JOURNAL_ATTACH=1`, review/progress helpers must not append `review.*` or `task.step_completed` events to the live batch journal. Harden attach resolution, worker verification, stub review env coupling, and test hygiene so `spine status --diagnose` stays trustworthy during active batches.

## Dependencies

- **None**

## Context to Read First

**Tier 3:**
- `src/batch/review.mjs` — `resolveBatchJournalContext()`, stub review path
- `src/batch/worker-host.mjs` — sets `SPINE_JOURNAL_ATTACH=1` on worker env
- `bin/spine-report-progress.mjs` — env-based progress writes
- `extensions/spine/worker-tools.ts` — `executeSpineReportProgress`
- `tests/batch/review.test.mjs`, `tests/worker-tools/review-step-tool.test.mjs` — known polluters
- `src/batch/journal.mjs` — `extractJournalDiagnosisHints` (symptom: false `review.failed` hints)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review.mjs`
- `bin/spine-report-progress.mjs`
- `extensions/spine/worker-tools.ts`
- `package.json`
- `scripts/worker-verify.sh` (new)
- `templates/agents/worker.md`
- `tests/batch/review.test.mjs`
- `tests/batch/journal-attach.test.mjs` (new)
- `tests/worker-tools/review-step-tool.test.mjs`
- `tests/worker-tools/report-progress.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Reproduce pollution: `SPINE_JOURNAL_ATTACH=1` + `npm test` writes review events to live batch journal
- [ ] List P0/P1 fix targets from conversation root-cause analysis

### Step 1: Attach gate design

> **Plan-review checkpoint**

- [ ] **P0-B:** Add `isJournalAttachBlocked()` — honor `SPINE_SUPPRESS_JOURNAL_ATTACH=1` and `npm_lifecycle_event === "test"`
- [ ] **P0-C:** Gate env-derived progress writes through `resolveBatchJournalContext()` (CLI + Pi tool)
- [ ] **P0-A:** Set suppress in `package.json` test script; add `scripts/worker-verify.sh`; document in worker template
- [ ] **P1:** Decouple `SPINE_REVIEW_STUB_FAIL` from `useStub` unless stub mode is explicitly active

**Artifacts:**
- Design note in STATUS Discoveries

### Step 2: Implement P0/P1 fixes

> **Code review checkpoint**

- [ ] Harden `resolveBatchJournalContext()` with attach block checks
- [ ] Update `runSpineReportProgress` and `executeSpineReportProgress` to require attach context (no raw `SPINE_BATCH_ID` fallback)
- [ ] Fix stub fail env coupling in `runStepReview`
- [ ] Add `scripts/worker-verify.sh`; set `SPINE_SUPPRESS_JOURNAL_ATTACH=1` in npm `test` script
- [ ] Update `templates/agents/worker.md` verification guidance

**Artifacts:**
- Modified source files above

### Step 3: Tests + verification

- [ ] Regression tests: attach env + suppress → no journal writes for review/progress
- [ ] Fix review CLI/tool tests to pass explicit `journal` or set stub env consistently
- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Documentation Requirements

**Must Update:**
- `templates/agents/worker.md` — verification command uses worker-verify script

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — only if diagnose/journal behavior documented there

## Completion Criteria

- [ ] `npm test` never appends to a live batch journal when worker attach env is inherited
- [ ] `SPINE_REVIEW_STUB_FAIL=1` alone does not enable stub review failure path
- [ ] Worker verification documented via `./scripts/worker-verify.sh`
- [ ] All tests pass

## Git Commit Convention

- **Step completion:** `feat(SP-070): complete Step N — description`
- **Fix:** `fix(SP-070): isolate batch journal attach during npm test`

## Do NOT

- Change batch engine journal schema
- Implement P2 diagnose hint filtering (optional follow-up)
- Broad refactor of worker-host env propagation

## Amendments

_(Workers only.)_
