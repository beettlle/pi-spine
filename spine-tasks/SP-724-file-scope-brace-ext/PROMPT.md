# Task: SP-724 — File-scope overlap: brace globs + ext probes

**Created:** 2026-08-25
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Analyzer correctness for parallel wave safety.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #269 — Expand brace globs `{a,b}` in file-scope probes; extend extension list (`.json`, `.cjs`, `.yaml`, `.yml`) or use bounded real-tree probe. Overlapping brace scopes and `.json`/`.cjs` collisions must be flagged by `spine tasks analyze`.

## Dependencies

- **None**

## Context to Read First

- `src/planner/file-scope.mjs` — expandScopeEntryProbes
- `src/tasks/analyze/index.mjs` — collectParallelFileScopeOverlapFindings
- GitHub #269

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/planner/file-scope.mjs`
- `src/tasks/analyze/index.mjs`
- `tests/planner/file-scope-overlap.test.mjs`
- `tests/tasks/analyze-cli.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/planner/file-scope-overlap.test.mjs tests/tasks/analyze-cli.test.mjs` |
| fileScopeMustChange | `src/planner/file-scope.mjs` |

## Steps

### Step 1: Brace + extension probes

- [ ] Expand `{a,b}` brace patterns into concrete probe paths
- [ ] Extend probe extensions (`.json`, `.cjs`, `.yaml`, `.yml`) or bounded tree walk
- [ ] Avoid false-positive storms on large repos (bound depth/walk)

### Step 2: Regression tests

- [ ] Unit tests for brace expansion in expandScopeEntryProbes
- [ ] Analyze integration: overlapping brace scopes → finding emitted

### Step 3: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — file-scope overlap notes if operator-facing

## Completion Criteria

- [ ] Brace glob overlap detected
- [ ] `.json`/`.cjs` overlap detected
- [ ] Closes #269
- [ ] `.DONE` created

## Do NOT

- Runtime worker file-scope enforcement
- Matrix file-scope substitution (#232)
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `fix(SP-724): file-scope brace glob and extension probes (#269)`
