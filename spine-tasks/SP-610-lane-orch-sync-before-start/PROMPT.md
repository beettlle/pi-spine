# Task: SP-610 — Lane orch sync before start

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Sync orch into lane worktree before task start so cross-lane bisect deps share a common ancestor.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #191 — When task B depends on task A and both touch the same File Scope path, lane B’s worktree must include orch’s landed A commit before B starts. Missing sync caused `merge_blocked` on `contract-verify.mjs` (SP-585/SP-603, batch `20260710T182711`).

**Source:** [`docs/PRD-v2.3.1-reliability-handoff.md`](../../docs/PRD-v2.3.1-reliability-handoff.md) §6 FR-REL231-03

**Out of scope for this task:** planner same-lane affinity; auto-resolve for re-export shims (defer).

## Dependencies

- **None**

## Context to Read First

- [`src/batch/engine-lanes.mjs`](../../src/batch/engine-lanes.mjs) — `runTaskOnLane`
- [`src/batch/worktree.mjs`](../../src/batch/worktree.mjs) — `provisionLaneWorktree`
- GitHub issue #191 reproduction (SP-585 → SP-603 cross-lane)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/worktree.mjs`
- `src/batch/engine-lanes.mjs`
- `tests/batch/lane-orch-sync.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/lane-orch-sync.test.mjs` |
| fileScopeMustChange | `src/batch/worktree.mjs`, `src/batch/engine-lanes.mjs` |
| artifactsMustExist | `tests/batch/lane-orch-sync.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm where subsequent tasks reuse an existing lane worktree without orch sync
- [ ] Identify how satisfied deps + shared File Scope can be detected at start

### Step 1: Sync helper + call site

- [ ] Add `syncLaneWorktreeFromOrch` (or equivalent) in `worktree.mjs`
- [ ] Call it from `runTaskOnLane` (or equivalent start path) before worker launch when deps that share File Scope have landed on orch
- [ ] Fail loud with actionable error if sync cannot complete

### Step 2: Testing & Verification

- [ ] Add `tests/batch/lane-orch-sync.test.mjs` — ancestor/shared-path fixture proving sync before start
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — merge_blocked recovery section (advisory only)

## Completion Criteria

- [ ] Dependent shared-scope tasks start on a worktree that includes orch dep commits
- [ ] Regression test covers the sync invariant
- [ ] Issue #191 closable after land (affinity/auto-resolve still deferred)

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Implement planner affinity or shim auto-merge
- Skip tests
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Edit diagnosis or worker-host (SP-608 / SP-609)

## Git Commit Convention

- `fix(SP-610): sync lane worktree from orch before task start`
