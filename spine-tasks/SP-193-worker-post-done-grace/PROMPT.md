# Task: SP-193 — Post-.DONE worker grace watchdog

**Created:** 2026-06-11
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Primary orchestration wedge fix — batch `20260611T222221` SP-190 hung 17m after `.DONE` while engine awaited pi child exit.
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix `runWorker()` in `src/batch/worker-host.mjs` so that when `.DONE` appears on disk but the worker child (pi runner) has not exited, the host does **not** exit the poll loop and disable stall/heartbeat watchdogs indefinitely.

**Incident:** SP-190 wrote `.DONE` and commit `b4807d1` at ~22:28 UTC; engine wedged until manual `kill` of pi child at 22:42. Journal shows `doneFound: true` + `classification: failed`.

**Required behavior:**
1. After `.DONE` detected, continue polling with a **post-done grace** (configurable, default ~3–5 min).
2. If child still alive after grace, `SIGTERM` (then `SIGKILL` after short backoff) the child.
3. If `.DONE` still present after termination, return `{ ok: true, doneFound: true }` (success path) — do not require `exitCode === 0` from a hung pi session.
4. Journal `worker.post_done_terminated` (or similar) when grace kill fires.
5. Preserve existing stall behavior **before** `.DONE`.

## Dependencies

- **Task:** SP-192

## Context to Read First

**Tier 3:**
- `src/batch/worker-host.mjs` — poll loop breaks on `.DONE` today (~lines 402–405)
- `src/batch/heartbeat.mjs`, `src/batch/task-stall-budget.mjs`
- `spine-tasks/_explore/reliability-epic/findings.md` — SP-190 wedge RCA
- `.spine/runtime/20260611T222221/journal/events.jsonl` (incident batch)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/worker-host.mjs`
- `src/config/defaults.mjs` (optional `lanes.postDoneGraceMinutes`)
- `src/batch/journal.mjs` (event type only if new)
- `tests/batch/worker-post-done-grace.test.mjs` (new)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | see File Scope |
| fileScopeMustNotChange | — |
| minLineCoverage | 77 |
| artifactsMustExist | — |

## Steps

### Step 0: Preflight

- [ ] Reproduce wedge logic in `worker-host.mjs`: `.DONE` break disables stall loop before `await childDone`
- [ ] Read incident journal + `worker-output-SP-190.log`

### Step 1: Implement post-done grace

> **Plan-review checkpoint**

- [ ] Add `postDoneGraceMs` to stall config (default 3–5 min)
- [ ] Replace bare `.DONE` break with grace window: heartbeats/stall optional during grace
- [ ] Terminate child after grace; succeed when `.DONE` persists

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Stub test: child hangs after writing `.DONE` → host terminates and returns `ok: true`
- [ ] Regression: pre-.DONE stall timeout still works
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Note fix in `spine-tasks/_explore/reliability-epic/findings.md`
- [ ] Create `.DONE` when complete

## Completion Criteria

- [ ] SP-190-class wedge cannot block batch > post-done grace duration
- [ ] `doneFound: true` + hung child → task succeeds (not `failed`)
- [ ] Tests green

## Git Commit Convention

- `feat(SP-193): complete Step N — description`

## Do NOT

- Remove stall detection before `.DONE`
- Treat missing `.DONE` after kill as success
