# Task: TP-015 — Segment model, lane commit, and resume foundation (Phase 3)

**Created:** 2026-06-01
**Size:** L

## Review Level: 2 (Plan and Code)

**Assessment:** Introduces spine-native segment records and batch resume/pause for single-lane batches; fixes empty merges when workers leave uncommitted work. Foundation for atomic retry (TP-016) and multi-lane (TP-017).
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Deliver **Phase 3 foundations** on `main`: (1) **auto-commit lane work** before merge so `orch/spine-*` branches contain real commits (TP-014 dogfood gap), (2) **segment records** in `.spine/batch-state.json` for single-task monorepo batches, and (3) **`spine batch pause` / `spine batch resume`** with journal events and §18.2 resume semantics for **one task / one lane**.

**In scope:** `commitLaneWorktree()` in engine (stage + commit on task branch when worker succeeds; fail loud if dirty without `.DONE`); `segments[]` on batch-state create/validate; `resumeBatch()` continuing paused/failed single-lane batches; CLI wiring + slash command delegation; tests; README + CONTEXT.

**Out of scope (defer to TP-016+):** atomic `/spine-retry-task`, multi-lane scheduler, abort archive (§18.6), mixed-outcome merge policy, skip/force-merge.

**Success:** After `spine batch start TP-015`, merge commit is **ahead of** base; `spine batch resume` continues a paused batch; `spine state validate` accepts segment fields; **75+** tests pass; `spine plan all` shows TP-015 in wave 7.

## Dependencies

- **TP-014** — journal schema v1, `spine state validate`, batch-history on complete/dismiss

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md` — Option B; Phase 3 next

**Tier 3:**
- `docs/PRD.md` — §10.1 batch-state, §18.2 resume, FR-BATCH-04/05, FR-WORK-02/03, FR-BATCH-08
- `src/batch/engine.mjs`, `src/batch/state.mjs`, `src/batch/worker-host.mjs`, `src/batch/reconcile.mjs`
- `docs/incidents/20260531-phase0-taskplane-batch.md` — uncommitted work + retry drift

## Environment

- **Workspace:** pi-spine repo root
- **Requires:** Node ≥22, git

## File Scope

- `src/batch/engine.mjs` (lane commit, resume entry)
- `src/batch/state.mjs` (segments in create/validate)
- `src/batch/resume.mjs` (new — resume algorithm single-lane)
- `src/batch/lane-commit.mjs` (new — git commit helper)
- `src/batch/readers/spine-state.mjs` (segment normalization)
- `bin/spine-batch.mjs` (pause/resume subcommands)
- `bin/spine.mjs` (wire if needed)
- `extensions/spine/slash-commands.ts` (delegate pause/resume to CLI when possible)
- `tests/batch/lane-commit.test.mjs` (new)
- `tests/batch/resume.test.mjs` (new)
- `tests/batch/engine.test.mjs` (extend)
- `README.md`

## Steps

### Step 0: Preflight

- [ ] Read PRD §18.2 and FR-BATCH-04/05
- [ ] Reproduce TP-014 gap: worker `.DONE` without commit → empty merge (document in STATUS)
- [ ] Confirm `spine preflight` passes on clean `main`

### Step 1: Lane auto-commit before merge

> **Plan-review checkpoint** — commit message format and fail-loud rules.

- [ ] Add `commitLaneWorktree({ worktreePath, taskBranch, taskId, batchId })` — `git status --porcelain`; if changes and `.DONE` exists, `git add -A` + commit `feat({taskId}): batch {batchId} worker completion`
- [ ] If dirty without `.DONE`, fail task with clear error (do not merge)
- [ ] Call from `engine.mjs` after successful worker, before `mergeLaneToOrch`
- [ ] Unit tests with temp git repo fixture

**Artifacts:** `src/batch/lane-commit.mjs`, `tests/batch/lane-commit.test.mjs`, `engine.mjs`

### Step 2: Segment records in batch-state

- [ ] Extend `createInitialBatchState` with `segments: [{ segmentId, taskId, status: "pending", repoId: "default" }]`
- [ ] On task terminal: update matching segment status (`succeeded` / `failed`)
- [ ] Extend `validateBatchState` for segment/task cross-refs
- [ ] `countPendingSegments(state, taskId)` helper for resume logging

**Artifacts:** `state.mjs`, `readers/spine-state.mjs`, `tests/batch/state-validate.test.mjs` (extend)

### Step 3: Pause and resume (single-lane)

- [ ] `pauseBatch({ projectRoot })` — phase → `paused`, journal `batch.paused`, no new scheduling
- [ ] `resumeBatch({ projectRoot, force })` — validate state; skip tasks with `.DONE` or journal `task.completed`; respawn worker in existing worktree for pending task; journal `batch.resumed` with `{ resumeForced, pendingSegments }`
- [ ] CLI: `spine batch pause|resume [--force] [--json]`
- [ ] Reconciliation: `paused` diagnosis suggests `spine batch resume` (not Taskplane pause when limbo)

**Artifacts:** `src/batch/resume.mjs`, `bin/spine-batch.mjs`, tests/batch/resume.test.mjs`

### Step 4: Integration tests and dogfood

- [ ] Engine test: mock worker success → lane branch has commit before merge
- [ ] Run `npm test` twice; `spine preflight`
- [ ] Dogfood: `spine batch start TP-015` (or operator runs after merge to main)

### Step 5: Documentation

- [ ] README: pause/resume, lane commit behavior
- [ ] Update `taskplane-tasks/CONTEXT.md`: TP-015 done; **Next Task ID: TP-016** (atomic retry)
- [ ] Update `docs/compatibility/taskplane-gap-list.md` if resume closes partial GAP (note only)

## Documentation Requirements

**Must Update:**
- `README.md`
- `taskplane-tasks/CONTEXT.md`

**Check If Affected:**
- `docs/PRD.md` — only on divergence

## Completion Criteria

- [ ] Successful batch merge produces orch branch commit **ahead of** `baseBranch` when worker modified files
- [ ] `segments[]` present in new batch-state; validate passes
- [ ] `spine batch pause` + `spine batch resume [--force]` work for single-lane active batch
- [ ] Journal contains `batch.paused` / `batch.resumed` on those operations
- [ ] Full `npm test` pass (**75+** tests)
- [ ] `spine plan all` shows TP-015 in wave 7

## Git Commit Convention

- **Step completion:** `feat(TP-015): complete Step N — description`

## Do NOT

- Implement multi-lane parallel engine (TP-017)
- Implement atomic retry or skip-task (TP-016)
- Implement abort archive (TP-018)
- Break Taskplane `.pi/batch-state.json` reader

---

## Amendments (Added During Execution)
