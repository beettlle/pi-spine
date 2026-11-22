# Task: SP-887 — Opt-in GitHub issue sync on land

**Created:** 2026-11-22
**Size:** M
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Network side effects on integrate; default must stay off; bad parse could close wrong issues.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 1, Reversibility: 0

## Mission

Closes #383 — After a linked task's `.DONE` is on the batch base (post-integrate success), optionally comment on and close/update GitHub issues from Mission `Closes #N` / `Partial #N`. Ship shared Mission issue-link parsing for reuse by SP-889. Opt-in via config (e.g. `integrations.github.syncOnLand`); fail soft without `gh`/auth; journal `github.issue_synced`; support dry-run / `--no-github-sync`.

## Dependencies

- **Task:** SP-886 (serialize shared `docs/adoption/operator-runbook.md` File Scope)

## Context to Read First

- GitHub #383 (parent epic #382)
- `src/batch/integrate.mjs` — `integrateOrchToBase`
- `src/config/defaults.mjs` — config defaults pattern
- `skills/spine-release-operator/SKILL.md` §4.3c
- `docs/release/post-mortem-v2.15.0.md` F-E
- `bin/spine-issue.mjs` — existing `gh` usage patterns

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None for unit tests (stub `gh`)

## File Scope

- `src/integrations/github/mission-issue-links.mjs`
- `src/integrations/github/sync-on-land.mjs`
- `src/batch/integrate.mjs`
- `src/config/defaults.mjs`
- `src/config/spine-config-schema.mjs`
- `bin/spine-integrate.mjs`
- `tests/integrations/github/mission-issue-links.test.mjs`
- `tests/integrations/github/sync-on-land.test.mjs`
- `docs/adoption/operator-runbook.md`
- `skills/spine-release-operator/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/integrations/github/mission-issue-links.test.mjs tests/integrations/github/sync-on-land.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-887` |
| fileScopeMustChange | `src/integrations/github/mission-issue-links.mjs`, `src/integrations/github/sync-on-land.mjs`, `src/batch/integrate.mjs`, `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Map integrate success → which tasks are `.DONE` on base
- [ ] Confirm config schema extension point for `integrations.github`

### Step 1: Parser + sync module

- [ ] Implement Mission `Closes`/`Partial` parser (same rules as #147)
- [ ] Implement opt-in sync: Closes → comment+close; Partial → comment only
- [ ] Soft-fail missing `gh`/auth with diagnose/journal hint
- [ ] Dry-run / `--no-github-sync` escape hatches
- [ ] Journal `github.issue_synced` (or equivalent) with issue number + action

### Step 2: Wire into integrate + docs

- [ ] Call sync after successful integrate when config enabled
- [ ] Default off (or clearly documented)
- [ ] Update runbook + release-operator §4.3c note

### Step 3: Testing & Verification

- [ ] Stubbed tests for parse + action mapping + soft-fail
- [ ] Run Contract `testCommand`

### Step 4: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`
- `skills/spine-release-operator/SKILL.md`

**Check If Affected:**
- `docs/release/post-mortem-v2.15.0.md` (reference only)

## Completion Criteria

- [ ] Opt-in config documented; default safe
- [ ] Closes/Partial behavior matches ACs
- [ ] Soft-fail without gh; journal events
- [ ] Shared parser module exists for SP-889
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `feat(SP-887): opt-in GitHub issue sync on land (#383)`

## Do NOT

- Enable sync by default without clear docs
- Close issues without `.DONE` on base + integrate success
- Hard-fail integrate when `gh` missing
- Implement Linear/Jira
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
