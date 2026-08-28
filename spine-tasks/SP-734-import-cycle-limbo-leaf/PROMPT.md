# Task: SP-734 — Break merge ↔ post-merge-limbo import cycle

**Created:** 2026-08-28
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** `engine-lanes/merge.mjs` imports `post-merge-limbo.mjs` which closes a large allowlisted cluster; requires leaf extraction.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #267 — Break the static import edge `engine-lanes/merge.mjs -> post-merge-limbo.mjs -> … -> engine-lanes.mjs`. Extract finalize/limbo hooks to a leaf (e.g. `post-merge-finalize.mjs` or callback injection) so merge does not import the full limbo module graph. Follow #83 slice C (`detached-spawn.mjs` leaf) patterns.

## Dependencies

- **Task:** SP-733 (resume facade leaf — reduces concurrent merge/resume churn)

## Context to Read First

- GitHub #267 — steps 3–4
- `src/batch/engine-lanes/merge.mjs` — `maybeFinalizeAfterWaveMerge` import
- `src/batch/post-merge-limbo.mjs`
- `tests/batch/post-merge-limbo.test.mjs`, `tests/batch/detached-start-land-loop.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/merge.mjs`
- `src/batch/post-merge-limbo.mjs`
- `src/batch/post-merge-finalize.mjs`
- `tests/arch/import-cycles.test.mjs`
- `tests/batch/post-merge-limbo.test.mjs`
- `tests/batch/post-merge-limbo-regression.test.mjs`
- `tests/batch/detached-start-land-loop.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/import-cycles.test.mjs tests/batch/post-merge-limbo.test.mjs tests/batch/detached-start-land-loop.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/merge.mjs` |

## Steps

### Step 0: Preflight

- [ ] Map import graph around `maybeFinalizeAfterWaveMerge`
- [ ] Confirm SP-733 integrated

### Step 1: Extract limbo finalize leaf

- [ ] Move shared finalize hook to leaf with no merge → limbo → engine-lanes cycle
- [ ] Rewire merge.mjs and post-merge-limbo.mjs imports

### Step 2: Shrink allowlist

- [ ] Remove limbo/merge cluster strings from `ALLOWED_CLUSTER_CYCLES` when cycle-free

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**

- `docs/adoption/operator-runbook.md` — only if limbo recovery semantics change

## Completion Criteria

- [ ] No static cycle through merge ↔ post-merge-limbo ↔ engine-lanes
- [ ] Limbo/regression tests pass
- [ ] `.DONE` created

## Do NOT

- Break evidence/gate triangle (already cycle-free per SP-432)
- Empty entire allowlist (SP-736)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `refactor(SP-734): break merge post-merge-limbo import cycle (#267)`
