# Task: SP-203 — Engine final-review orphan recovery

**Created:** 2026-06-12
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Land-loop wedge — detached engine stuck in `spawnSync(pi)` final review while resume completes batch.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **engine orphan during final review** and **resume vs in-flight engine race** exposed by batch `20260612T011148`:

1. SP-194 final `review.started` hung; batch stayed `running` after merges; gate missing until resume.
2. Resume marked `batch.completed` + opened gate while orphaned engine still running; `review.failed` (timeout) landed after terminal batch events.

**Required behavior:**
1. On `spine batch resume`, SIGTERM prior detached engine PID (`readBatchEnginePid`) before starting new engine when phase is `failed`/`paused` and PID is alive.
2. Resume path honors `findCompletedFinalReview` PASS before re-spawning review (mirror engine lane path).
3. Do not journal `task.failed` for review after `batch.completed` / `batch.dismissed` in same session.
4. Regression tests: orphaned engine PID killed on resume; honored final review skips spawn.

## Dependencies

- **Task:** SP-192
- **Task:** SP-200

## Context to Read First

**Tier 3:**
- `src/batch/review.mjs` — `spawnReviewerPi`, `findCompletedFinalReview`
- `src/batch/resume-multi.mjs`, `src/batch/resume-multi-lanes.mjs`
- `src/batch/detached-start.mjs`, `src/batch/state.mjs` — `readBatchEnginePid`
- Batch `20260612T011148` journal timeline

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume-multi.mjs`
- `src/batch/resume-multi-lanes.mjs`
- `src/batch/detached-start.mjs`
- `src/batch/review.mjs`
- `tests/batch/engine-review-orphan.test.mjs` (new)
- `spine-tasks/_explore/reliability-epic/findings.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/resume-multi.mjs`, `src/batch/resume-multi-lanes.mjs`, `src/batch/detached-start.mjs`, `tests/batch/engine-review-orphan.test.mjs` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Reconstruct batch `20260612T011148` journal ordering (`review.started` → merge → resume → `review.failed`)
- [ ] Identify engine PID lifecycle on detached resume

### Step 1: Orphan kill + honor final review on resume

> **Plan-review checkpoint**

- [ ] Kill stale engine PID at resume entry when safe
- [ ] Skip final review spawn when honored PASS exists

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Stub orphaned-PID + honored-review regression tests
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Update findings.md
- [ ] Create `.DONE`

## Git Commit Convention

- `feat(SP-203): complete Step N — description`
