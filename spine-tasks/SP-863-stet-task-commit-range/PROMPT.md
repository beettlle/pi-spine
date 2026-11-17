# Task: SP-863 — Stet contract review range = task commits only; dismissals survive task switches

**Created:** 2026-11-16
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Retried tasks get gated on later lane tasks' commits; operator dismissals vanish across task switches.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `scripts/spine-stet-contract-run.sh` scopes review to `parent(first task commit)..HEAD`. After later tasks commit on the same lane, a retried task's `HEAD` includes their commits, so stet reviews (and blocking `reviewPolicy`) attribute foreign diffs to the retried task. Separately, when the computed baseline differs from the open session baseline, the script runs `stet finish` and starts a new session — losing prior `stet dismiss` triage across task switches (#373).

## Mission

Closes #373 — Stet contract reviews stay on the retried task's own commits, and dismissals are not wiped by baseline thrash:

1. **Range bound** — Bound the reviewed range to the task's own commits: from `parent(first task-folder commit after lane baseline)` through the **last** commit that touches the task folder (not unbounded `HEAD` when later tasks have committed). If no task commits exist, keep today's fail-closed / empty-diff behavior.
2. **Session / dismissals** — Do not `stet finish` + fresh `stet start` solely because a sibling task on the lane changed `HEAD`. Prefer keeping the open session when the task-scoped baseline is unchanged, or re-attach in a way that preserves dismissals for the same code (stet v1.4+ line-shift dismissals). Document the chosen approach in STATUS Discoveries.
3. **Tests** — Add or extend a script/unit test (shell or node fixture) that simulates two task folders on one lane: after a later task commits, a re-run for the earlier taskId does not include the later task's paths in the computed range. Prefer a deterministic fixture over requiring LM Studio.

## Dependencies

- **None**

## Context to Read First

- GitHub #373
- `scripts/spine-stet-contract-run.sh` (baseline / first_task_commit / session switch)
- `docs/stet-overview.md` (behavior — do not edit unless a one-line correction is required; prefer Discoveries)
- Existing stet contract tests if any: `rg -n "spine-stet-contract-run|first_task_commit" tests/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None for the range logic test; stet binary only if an existing integration test already requires it
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `scripts/spine-stet-contract-run.sh`
- `tests/scripts/spine-stet-contract-range.test.mjs` (create; focused range/baseline fixture)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/scripts/spine-stet-contract-range.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-863` |
| fileScopeMustChange | `scripts/spine-stet-contract-run.sh`, `tests/scripts/spine-stet-contract-range.test.mjs` |
| fileScopeMustNotChange | `.review/**`, `src/**` |

## Steps

### Step 0: Preflight

- [ ] Read the current baseline/first_task_commit/session-switch block; list exact lines that open `..HEAD` and that finish/restart sessions
- [ ] `rg -n "spine-stet-contract-run|first_task_commit" tests/`

### Step 1: Bound range + preserve dismissals

- [ ] End range at last task-folder commit (not later siblings' HEAD)
- [ ] Avoid dismissal-wiping session restart across task switches when baseline for this task is stable

**Artifacts:**
- `scripts/spine-stet-contract-run.sh` (modified)

### Step 2: Tests

- [ ] Fixture: earlier task re-review excludes later task commits/paths

**Artifacts:**
- new or extended test under `tests/` (modified)

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-863-stet-task-commit-range/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/stet-overview.md` — note gaps in Discoveries; edit only if a factual one-liner is wrong

## Completion Criteria

- [ ] Retried task review range ends at the task's last folder commit, not sibling HEAD
- [ ] Session handling no longer drops dismissals solely because a later lane task committed
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-863): bound stet contract review to task commits`

## Do NOT

- Leave range as `first^..HEAD` when later tasks have committed
- Edit `src/` (script-only fix)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
