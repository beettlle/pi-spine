# Task: SP-708 — Worker-runner flush pi output on DONE-missing

**Created:** 2026-08-19
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Single-path fix in worker runner; mirrors existing non-zero exit behavior.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #253 — When pi exits **0** but `{taskFolder}/.DONE` is missing, `bin/spine-worker-runner.mjs` must write pi `stdout`/`stderr` to the worker log (capped if huge) before exiting 1, same as the non-zero exit path (~lines 435–443). Operators need salvage context when diagnosis is `worker_done_missing`.

## Dependencies

- **None**

## Context to Read First

- `bin/spine-worker-runner.mjs` — DONE-missing path (~446–448) vs non-zero path (~435–443)
- GitHub #253
- `tests/batch/worker-runner.test.mjs` — if present; otherwise add scoped test

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-worker-runner.mjs`
- `tests/batch/worker-runner-done-missing.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/worker-runner-done-missing.test.mjs` |
| fileScopeMustChange | `bin/spine-worker-runner.mjs`, `tests/batch/worker-runner-done-missing.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm non-zero path already writes stdout/stderr; DONE-missing path does not
- [ ] Choose output cap strategy (reuse existing cap helper if any)

### Step 1: Implement flush on DONE-missing

- [ ] On DONE-missing path, write `result.stderr` and `result.stdout` before `process.exit(1)`
- [ ] Cap combined output if over reasonable limit (document constant)
- [ ] Unit test: mock/spawn stub where pi exits 0 without `.DONE` and output is captured

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:** (none — code-only)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — only if salvage workflow needs a one-line note

## Completion Criteria

- [ ] DONE-missing path emits pi stdout/stderr to worker log
- [ ] Scoped tests pass
- [ ] Closes #253

## Do NOT

- Change exit code semantics (still exit 1 on DONE-missing)
- Skip tests
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-708): flush pi output when .DONE missing (#253)`
