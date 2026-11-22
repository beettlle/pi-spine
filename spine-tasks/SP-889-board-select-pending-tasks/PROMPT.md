# Task: SP-889 — Select pending tasks from GitHub label/milestone

**Created:** 2026-11-22
**Size:** M
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Wrong matching could start unrelated tasks; selection only — never auto-start batches.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 0

## Mission

Closes #386 — Map GitHub labels or a milestone to pending spine task IDs via Mission `Closes`/`Partial` links, and print a comma-separated ID list usable with `spine plan` / `spine batch start`. Reuse SP-887's Mission issue-link parser. Engine still loads packets from disk; no always-on poller. Closing this child completes epic #382 when SP-883–SP-888 are also done — Mission also notes `Closes #382` only after those siblings are on `main` (operator §4.3c closes #382 when all four children `.DONE`).

## Dependencies

- **Task:** SP-887 (shared `mission-issue-links` parser)

## Context to Read First

- GitHub #386 (parent epic #382)
- `src/integrations/github/mission-issue-links.mjs` (from SP-887)
- `bin/spine-plan.mjs` / `src/planner/` — plan selection surfaces
- `src/tasks/packet/discover.mjs` — pending task discovery
- `docs/adoption/agent-orchestrated-waves.md`
- `docs/adoption/operator-runbook.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None for unit tests (stub `gh` issue list + fixture packets)

## File Scope

- `src/cli/board-select.mjs`
- `bin/spine-plan.mjs`
- `tests/cli/board-select.test.mjs`
- `docs/adoption/operator-runbook.md`
- `docs/adoption/agent-orchestrated-waves.md`
- `skills/spine-orchestrate-waves/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/cli/board-select.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-889` |
| fileScopeMustChange | `src/cli/board-select.mjs`, `bin/spine-plan.mjs`, `tests/cli/board-select.test.mjs`, `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `.review/**`, `bin/spine-tasks.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-887 parser export API
- [ ] Choose CLI surface (`spine plan --github-label` / `--milestone` or equivalent)

### Step 1: Resolution + CLI

- [ ] Resolve open issues for label and/or milestone via `gh`
- [ ] Match pending task folders whose Mission links those issues
- [ ] Print task ID list suitable for plan/batch selection
- [ ] Clear non-goal messaging: no always-on poller / no auto batch start

### Step 2: Testing & Verification

- [ ] Operator + orchestrate-waves docs
- [ ] Tests for issue→task ID resolution
- [ ] Run Contract `testCommand`

### Step 3: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`
- `docs/adoption/agent-orchestrated-waves.md`

**Check If Affected:**
- `skills/spine-orchestrate-waves/SKILL.md`
- `skills/spine-release-operator/SKILL.md`

## Completion Criteria

- [ ] Documented command: label/milestone → pending task IDs
- [ ] Matching uses Mission Closes/Partial via shared parser
- [ ] Output usable with existing plan/batch selection
- [ ] Tests cover resolution
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `feat(SP-889): select pending tasks from GitHub label/milestone (#386)`

## Do NOT

- Auto-start batches from board events
- Mutate issue state as lane locks
- Touch `bin/spine-tasks.mjs` (SP-888 owns hydrate CLI)
- Implement Linear/Jira
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
