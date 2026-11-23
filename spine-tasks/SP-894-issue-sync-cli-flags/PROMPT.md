# Task: SP-894 — CLI flags --no-issue-sync and --issue-label

**Created:** 2026-11-23
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Operators with scripts using old flags break; fail closed — no silent alias for old flags.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Partial #387 — Replace public CLI flags: `spine integrate --no-issue-sync` (was `--no-github-sync`) and `spine plan --issue-label` (was `--github-label`). No silent alias for old flags. Update board-select help/errors and CLI tests. Do not rename journal events (SP-895).

## Dependencies

- **Task:** SP-893

## Context to Read First

- GitHub #387
- `bin/spine-integrate.mjs` — `--no-github-sync`
- `src/cli/board-select.mjs` — `BOARD_LABEL_FLAG`
- `bin/spine-plan.mjs` — board-select wiring

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-integrate.mjs`
- `bin/spine-plan.mjs`
- `src/cli/board-select.mjs`
- `src/integrations/issues/sync-on-land.mjs`
- `src/batch/integrate.mjs`
- `tests/cli/board-select.test.mjs`
- `tests/integrations/issues/sync-on-land.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/cli/board-select.test.mjs tests/integrations/issues/sync-on-land.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-894` |
| fileScopeMustChange | `bin/spine-integrate.mjs`, `tests/cli/board-select.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm sync module path is `src/integrations/issues/` (SP-893)
- [ ] Grep for `--github-label` / `--no-github-sync` call sites

### Step 1: Rename public flags

- [ ] `--no-issue-sync` in integrate CLI + param plumbing (`noIssueSync`)
- [ ] `--issue-label` in board-select / spine-plan
- [ ] Reject / stop recognizing old flag names (fail closed)
- [ ] Update help text and tests

### Step 2: Testing & Verification

- [ ] Run Contract `testCommand`

### Step 3: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (operator docs in SP-896)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (SP-896)

## Completion Criteria

- [ ] New flags work; old flags not accepted
- [ ] Board-select + integrate tests green
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `feat(SP-894): rename issue-sync CLI flags (#387)`

## Do NOT

- Alias old flag names
- Rename journal event types (SP-895)
- Edit skill/runbook docs (SP-896)
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- **2026-11-23 prelanded:** `src/cli/board-select.mjs` already changed on main (SP-891); removed from `fileScopeMustChange`. Worker may still edit it for `--issue-label`.
