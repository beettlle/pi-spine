# Task: SP-104 — Lane commit ordering + scoped dirty filter

**Created:** 2026-06-05
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** `commitLaneWorktree` uses `git add -A` and can run while worker/git state is inconsistent; broken worktrees and out-of-scope dirty files cause `dirty_after_lane_commit` and engine crashes during resume (searchATon `20260603T224829`).
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Harden lane auto-commit:

1. **Ordering:** Record worker terminal state (`task.completed` / `task.failed`) and journal events **before** `commitLaneWorktree`; never commit while task still `running`.
2. **Scoped dirty filter:** Stage only file-scope paths + task folder (STATUS, `.DONE`, `.reviews`) — not blind `git add -A`; surface out-of-scope dirty paths in `task.failed` output.
3. **Health gate:** Skip or fail lane commit when worktree git metadata unhealthy (uses SP-101 health check).

Align `engine-lanes.mjs`, `resume-multi.mjs`, and `resume.mjs` to shared ordering.

## Dependencies

- **Task:** SP-101 (worktree git health check / repair)
- **Task:** SP-102 (hook may leave expected symlinks — dirty filter must not treat hook artifacts as failures when in scope)

## Context to Read First

**Tier 3:**
- `src/batch/lane-commit.mjs` — `commitLaneWorktree`, `gitPorcelain`
- `src/batch/engine-lanes.mjs` — post-worker lane commit (~426–468)
- `src/batch/resume-multi.mjs` — resume lane commit path
- `src/batch/resume.mjs` — single-task resume commit
- `src/batch/heartbeat.mjs` — `resolveScopedDirtyPaths` (reuse for commit filter)
- `docs/incidents/20260604-resume-parallel-lane-orphan.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lane-commit.mjs`
- `src/batch/engine-lanes.mjs`
- `src/batch/resume-multi.mjs`
- `src/batch/resume.mjs`
- `src/batch/worker-host.mjs` (if terminal-state ordering touches wait loop)
- `tests/batch/lane-commit-hardening.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Trace `commitLaneWorktree` call sites in engine-lanes / resume-multi / resume
- [ ] Confirm `git add -A` commits out-of-scope files today

### Step 1: Scoped commit + health gate

> **Plan-review checkpoint**

- [ ] Refactor `commitLaneWorktree` to accept `fileScopePaths` + `taskFolder`; stage scoped paths only
- [ ] Call `assertLaneWorktreeGitHealthy` (SP-101) before commit; return `failureClass: WorktreeUnhealthy` when repair fails
- [ ] List out-of-scope dirty paths (up to 20) in error message per FR-WT-04 style
- [ ] Call `spine_review_step` (plan)

### Step 2: Terminal-state ordering

> **Code review checkpoint**

- [ ] Ensure `task.completed` / `task.failed` journal + batch-state terminal update precede lane commit in all three call sites
- [ ] Guard: refuse lane commit when task status is `running`
- [ ] Call `spine_review_step` (code)

### Step 3: Testing & Verification

- [ ] Test: in-scope dirty + `.DONE` → commit; out-of-scope dirty → `DirtyWorktree` with path list
- [ ] Test: unhealthy worktree → fail before `git commit`
- [ ] FULL suite: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test`
- [ ] Coverage gate: `npm run coverage:check` — **≥77%**

### Step 4: Documentation & Delivery

- [ ] Operator runbook: lane commit only stages file scope
- [ ] STATUS.md discoveries

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — lane commit / dirty worktree troubleshooting
- `docs/incidents/20260604-resume-parallel-lane-orphan.md` — cross-link fix

## Completion Criteria

- [ ] Lane commit never runs for `running` tasks
- [ ] Out-of-scope dirty files block commit with listed paths
- [ ] Resume path uses same hardened commit as batch start

## Git Commit Convention

- `feat(SP-104): scoped lane commit dirty filter`
- `feat(SP-104): lane commit after terminal task state`
- `test(SP-104): lane commit hardening regression`

## Do NOT

- Re-implement per-lane resume serialization (SP-096 — done)
- Change diagnosis taxonomy (SP-105)

---

## Amendments (Added During Execution)
