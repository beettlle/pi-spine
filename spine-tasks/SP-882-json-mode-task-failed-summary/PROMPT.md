# Task: SP-882 — Summarize pi --mode json failure output for task.failed journal

**Created:** 2026-11-21
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** task.failed journals full JSONL stdout starting with system message_start (~65KB+) → 32KiB journal cap leaves only system-prompt preview; dashboard/diagnose blinded.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** After SP-878/879 workers use --mode json. engine-lanes spreads workerResult (including output) into task.failed; journal.capPayloadSize truncates to 32KiB from the start of the payload, which is the system prompt NDJSON — not exit reason or assistant text.

## Mission

Closes #381 — Failure journals must stay readable under the 32 KiB payload cap.

1. **Summarize** — Before `task.failed` journals worker `output`, replace raw `--mode json` NDJSON with a compact summary: `exitCode`, `classification`, short assistant/error text (reuse SP-878 text extract / strip system `message_start`/`message_end`), and optional `workerOutputLogRef` pointer to the full lane log.
2. **Hook point** — Prefer `finalizeWorkerOutput` / failure result builder so all `task.failed` paths benefit; do not raise `MAX_PAYLOAD_BYTES` as the fix.
3. **Non-JSON** — Text-mode / stub failures keep existing tail capture behavior.
4. **Tests** — Fixture with oversized system-prompt JSONL → journaled output (or pre-cap payload) fits well under 32 KiB and does not begin with system preamble; includes exitCode/classification signal.

## Dependencies

- **None** (disjoint from SP-881; may import pi-json-usage text helper)

## Context to Read First

- GitHub #381
- `src/batch/worker-output.mjs` finalizeWorkerOutput / captureWorkerOutputTail
- `src/batch/worker-host.mjs` buildWorkerFailureResult
- `src/batch/engine-lanes.mjs` task.failed spread of workerResult
- `src/batch/journal.mjs` MAX_PAYLOAD_BYTES / capPayloadSize
- `src/batch/pi-json-usage.mjs` text extract helpers (SP-878)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/worker-output.mjs`
- `src/batch/worker-host.mjs`
- `src/batch/pi-json-usage.mjs`
- `tests/batch/worker-output.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/worker-output.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-882` |
| fileScopeMustChange | `src/batch/worker-output.mjs`, `tests/batch/worker-output.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Trace finalizeWorkerOutput → task.failed → capPayloadSize
- [ ] Confirm SP-878 text extract API

### Step 1: JSON-mode failure summary

- [ ] Detect NDJSON / mode json output
- [ ] Replace dump with compact summary + log ref

### Step 2: Tests

- [ ] Oversized system-prompt fixture → under 32KiB readable summary

### Step 3: Testing & Verification

- [ ] Run Contract testCommand
- [ ] Fix failures

### Step 4: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create .DONE

- [ ] Create `spine-tasks/SP-882-json-mode-task-failed-summary/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (dirty-tree / salvage / failure diagnosis)

## Completion Criteria

- [ ] Trace finalizeWorkerOutput → task.failed → capPayloadSize
- [ ] Confirm SP-878 text extract API
- [ ] Detect NDJSON / mode json output
- [ ] Replace dump with compact summary + log ref
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-882): summarize json-mode failure output for task.failed (#381)`

## Do NOT

- Raise MAX_PAYLOAD_BYTES as the primary fix
- Drop exitCode/classification from failure records
- Change salvage dirty rules (#380 — SP-881)
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
