# Task: SP-200 — Resume opens integrate gate reliably

**Created:** 2026-06-11
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Land-loop gap after batch `20260611T225006` — `spine batch resume` completed SP-193 but `gate.json` was missing until manual `openIntegrateGateAfterBatchComplete`.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **integrate gate not opened (or not observable) after detached resume** so operators can run the land loop without manual gate recovery.

**Incident:** After `spine batch pause` + `spine batch resume SP-193 --skip-preflight`, batch reached `phase: completed` / `needs_integrate` but `spine gate status` reported *No integrate gate on record*. Evidence dir had partial artifacts (`summary.md`, `diff-stat.txt`) but no `gate.json` until manual open (~2 min test collection).

**Hypotheses to verify and fix:**
1. **Detached waiter race** — `waitForDetachedBatchResume` in `src/batch/detached-start.mjs` returns `resume_completed` when batch `phase` hits `completed`, while the engine child may still be inside `openIntegrateGateAfterBatchComplete()` (evidence collection is slow/sync).
2. **Multi-lane resume path** — batch `20260611T225006` had 4 provisioned lanes / 1 task; confirm `resumeMultiTaskBatch` always reaches `openIntegrateGateAfterBatchComplete` on the `skippedDoneOnDisk` fast path.
3. **Ordering** — consider opening gate **before** publishing terminal batch phase, or journal `gate.opened` before `batch.completed` so waiters and diagnose can rely on gate presence.

**Required behavior:**
- After any successful resume that ends in `needs_integrate`, `spine gate status` shows a pending integrate gate without manual intervention.
- Detached resume with default wait semantics does not report success until gate record exists (when `gates.requireBeforeIntegrate` is true).
- Regression test: stub evidence collection; resume-from-paused fixture asserts `gate.json` + `gate.opened` journal event.

## Dependencies

- **Task:** SP-193

## Context to Read First

**Tier 3:**
- `src/batch/detached-start.mjs` — `evaluateDetachedResumeWait`, `waitForDetachedBatchResume`
- `src/batch/resume.mjs`, `src/batch/resume-multi.mjs` — `openIntegrateGateAfterBatchComplete` call sites
- `src/batch/resume-multi-lanes.mjs` — `markTaskCompleteFromDisk` / `skippedDoneOnDisk`
- `src/batch/gate.mjs`, `src/batch/evidence.mjs`
- Batch `20260611T225006` journal (`batch.resumed`, `batch.completed`; no `gate.opened`)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/detached-start.mjs`
- `src/batch/resume.mjs`
- `src/batch/resume-multi.mjs`
- `src/batch/gate.mjs`
- `tests/batch/detached-resume-gate.test.mjs` (new)
- `tests/batch/resume-gate-open.test.mjs` (new)
- `docs/adoption/operator-runbook.md` (gate race §5 — only if behavior changes)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/detached-start.mjs`, `src/batch/resume.mjs`, `src/batch/resume-multi.mjs`, `tests/batch/detached-resume-gate.test.mjs`, `tests/batch/resume-gate-open.test.mjs` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Reproduce or trace batch `20260611T225006` resume path (multi-lane + detached waiter)
- [ ] Confirm whether engine child exited before `gate.json` write

### Step 1: Fix gate-open ordering / waiter

> **Plan-review checkpoint**

- [ ] Ensure gate opens reliably on resume completion (ordering or waiter gate check)
- [ ] Stub/skip slow evidence in tests; keep production evidence behavior

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Add resume + detached-wait regression tests
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Note fix in `spine-tasks/_explore/reliability-epic/findings.md`
- [ ] Create `.DONE` when complete

## Testing

- `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- `npm run coverage:check` — ≥77%

## Completion Criteria

- [ ] Resume → `needs_integrate` always has integrate gate on record
- [ ] Detached resume success waits for gate when required
- [ ] Tests green

## Git Commit Convention

- `feat(SP-200): complete Step N — description`

## Do NOT

- Disable integrate gate requirement by default
- Remove evidence collection from gate open in production
