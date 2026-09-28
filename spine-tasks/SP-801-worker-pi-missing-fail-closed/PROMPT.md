# Task: SP-801 — Worker fails closed when pi is missing from PATH (no implicit stub)

**Created:** 2026-09-27
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Worker launch path; tests or environments that silently relied on the implicit stub will now fail loudly.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 1, Reversibility: 1
**Problem theory:** `runWorker` (`src/batch/worker-host.mjs` ~186-189) switches to the stub worker whenever `pi` is not on PATH, even with `SPINE_WORKER_STUB` unset. The stub writes a `.DONE` marker indistinguishable from a real completion, so a review-level-0 task can be marked done with no work. Detached engines, resumed batches and sequence children can inherit a PATH without `pi`; `--skip-preflight`, internal `skipPreflight: true` (sequence/detached) and `spine batch resume` / `retry` bypass the doctor `pi installed` check. Every stub guard keys off the env var only. The reviewer path already fails closed (`src/batch/review-step-run.mjs` ~371-379).

## Mission

Closes #299 — The stub worker runs only when `SPINE_WORKER_STUB` is explicitly set; otherwise a missing `pi` fails the launch with a journaled reason and no `.DONE`.

1. Remove the `!commandExists("pi")` clause from `useStub`.
2. Right after, when the stub is not explicit, the backend is not `agentSession`, and `!commandExists("pi")`: journal `worker.spawn_failed` `{ taskId, reason: "pi_missing" }` (when `projectRoot` and `batchId` are set) and return `{ ok: false, classification: "launch_failed", exitCode: 1, output: "worker requires pi on PATH (fail closed); set SPINE_WORKER_STUB=1 only for stub runs" }` — match the return shape other launch failures in `runWorker` use.
3. Because this lives in `runWorker`, resume, retry and sequence/detached children are covered without preflight.
4. **Tests** — new `tests/batch/worker-host-pi-missing.test.mjs`: PATH without `pi`, `SPINE_WORKER_STUB` unset, review level 0 → `launch_failed`, no `.DONE`, journal event with `reason: "pi_missing"`; same with `SPINE_WORKER_STUB=1` → stub runs as before; `agentSession` backend is unaffected. Before writing, `rg -n "SPINE_WORKER_STUB" tests` and fix any test that deletes the env var and relied on the implicit fallback (list them in STATUS Discoveries).

## Dependencies

- **None**

## Context to Read First

- GitHub #299
- `src/batch/worker-host.mjs` ~160-230 (`runWorker` start, `useStub`, existing launch-failure returns)
- `src/util/command-exists.mjs`
- `src/batch/review-step-run.mjs` ~371-379 — fail-closed message style
- `tests/batch/stub-runner-delivery.test.mjs`, `tests/batch/stub-release-task-guard.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/worker-host.mjs`
- `tests/batch/worker-host-pi-missing.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/worker-host-pi-missing.test.mjs tests/batch/stub-runner-delivery.test.mjs tests/batch/stub-release-task-guard.test.mjs tests/batch/review.test.mjs` |
| fileScopeMustChange | `src/batch/worker-host.mjs`, `tests/batch/worker-host-pi-missing.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] `rg -n "SPINE_WORKER_STUB" tests` — find tests that unset the env var
- [ ] Note the return shape of existing launch failures in `runWorker`
- [ ] Dependencies satisfied

### Step 1: Fail closed

- [ ] Implicit stub clause removed
- [ ] `pi` missing → `worker.spawn_failed` `pi_missing` + `launch_failed`, no `.DONE`

**Artifacts:**
- `src/batch/worker-host.mjs` (modified)

### Step 2: Tests

- [ ] pi missing + stub unset → `launch_failed`, no `.DONE`, journal event
- [ ] Explicit stub unchanged
- [ ] `agentSession` unaffected

**Artifacts:**
- `tests/batch/worker-host-pi-missing.test.mjs` (new)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-803)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §3 Worker backend default

## Completion Criteria

- [ ] pi absent + stub unset → `launch_failed`, no `.DONE`
- [ ] Explicit `SPINE_WORKER_STUB=1` unchanged
- [ ] Journal event records the reason
- [ ] Closes #299

## Git Commit Convention

- `fix(SP-801): fail closed when pi is missing instead of implicit stub (#299)`

## Do NOT

- Change `agentSession` backend selection
- Rework the doctor `pi installed` check
- Add `mode: "stub"` to the `.DONE` payload (optional follow-up)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
