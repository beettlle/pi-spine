# Task: SP-865 — Runbook: contract artifactsMustExist / fileScopeMustNotChange fail-closed

**Created:** 2026-11-18
**Size:** S
**Type:** llm

## Review Level: 0 (None)

**Risk:** Docs-only. Stale contract guidance leaves operators treating git-diff failures as green must-not-change checks.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** Issue #309 lands in SP-867. Operators need runbook language for artifactsMustExist traversal rejection, ** glob matching, and fail-closed fileScopeMustNotChange when git diff fails.

## Mission

Operators can diagnose and author contracts against the fail-closed contract rules from #309:

1. **artifactsMustExist** — Patterns containing `..` are rejected; `**` globs match files under the intended tree (not a literal `**` directory).
2. **fileScopeMustNotChange** — When `git diff --name-only HEAD` fails or times out, the check fails closed (does not pass on an empty file list).
3. **Operator recovery** — Point authors at scoped contracts and healthy git in the lane; do not treat a missing diff as "no forbidden changes".

Docs only — implementation is SP-867.

## Dependencies

- **None** (documents intended SP-867 behavior; no file overlap with code packet)

## Context to Read First

- GitHub #309
- `docs/adoption/operator-runbook.md` contract / fileScopeMustNotChange sections (~2658+)
- `spine-tasks/_authoring/release-v2.32.0/manifest.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None


## File Scope

- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `scripts/**` |

## Steps

### Step 0: Preflight

- [ ] Locate runbook contract / fileScopeMustNotChange sections; list sentences that contradict fail-closed #309

### Step 1: Contract fail-closed docs

- [ ] Document artifactsMustExist `..` rejection and `**` glob behavior
- [ ] Document fileScopeMustNotChange fail-closed when git diff fails
- [ ] Cross-link SP-867 / #309

### Step 2: Testing & Verification

- [ ] `rg -l 'operator-runbook.md' tests/` and run only hits with `node --experimental-strip-types --test --test-reporter=dot <files>` (none → note "no tests reference this doc")
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-865-runbook-contract-fail-closed/.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — contract fail-closed (#309)

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` (record gaps in Discoveries; do not edit)

## Completion Criteria

- [ ] Runbook documents artifactsMustExist / must-not-change fail-closed behavior
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `docs(SP-865): runbook contract artifacts and must-not-change fail-closed`

## Do NOT

- Edit `src/` or `bin/`
- Implement #309 code (SP-867)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
