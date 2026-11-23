# Task: SP-888 — Hydrate SP-* packet from GitHub issue

**Created:** 2026-11-22
**Size:** M
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Scaffold could invent fake File Scope or silent deps; keep stubs incomplete until operator fills Contract.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 0

## Mission

Closes #384 — Add `spine tasks from-issue <n>` (and create-spine-tasks skill step) that fetches an issue via `gh`, scaffolds `spine-tasks/SP-###-<slug>/` with Mission `Closes #N` or `Partial #N`, short Mission from title + pointer to `#N`, and required Contract/File Scope/Steps stubs. Do not write `dependencies.json` edges or claim Contract completeness without confirmation. Document validate-after-fill path.

## Dependencies

- **Task:** SP-883 (thin-packet conventions — Mission/Context shape)

## Context to Read First

- GitHub #384 (parent epic #382)
- `bin/spine-tasks.mjs` — subcommand dispatch
- `src/tasks/packet/` — packet shape / validate
- `spine-tasks/CONTEXT.md` — Next Task ID
- `skills/create-spine-tasks/SKILL.md`
- `docs/adoption/upstream-execution-workflow.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None for unit tests (stub `gh` issue JSON)

## File Scope

- `bin/spine-tasks.mjs`
- `src/tasks/from-issue.mjs`
- `tests/tasks/from-issue.test.mjs`
- `skills/create-spine-tasks/SKILL.md`
- `docs/adoption/upstream-execution-workflow.md`
- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/tasks/from-issue.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-888` |
| fileScopeMustChange | `bin/spine-tasks.mjs`, `src/tasks/from-issue.mjs`, `tests/tasks/from-issue.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Inspect `spine tasks` subcommand patterns and Next Task ID update convention
- [ ] Confirm thin-packet Mission/Context examples from SP-883

### Step 1: CLI scaffold

- [ ] Implement `spine tasks from-issue <n>` with `--closes` / `--partial` (or prompt flag)
- [ ] Create folder + PROMPT/STATUS stubs; Mission uses standard link format (#147)
- [ ] Leave Contract incomplete until operator fills; no silent `dependencies.json` edges
- [ ] Touch CONTEXT Next Task ID only with explicit confirmation / documented flag

### Step 2: Testing & Verification

- [ ] Document skill step + validate-after-fill
- [ ] Golden fixture for scaffold shape
- [ ] Run Contract `testCommand`

### Step 3: Documentation & Delivery

- [ ] Update upstream-execution-workflow
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/SKILL.md`
- `docs/adoption/upstream-execution-workflow.md`

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] Documented CLI and/or skill path issue → packet folder
- [ ] Mission uses Closes/Partial; Contract not claimed complete
- [ ] No automatic deps edges without confirmation
- [ ] Tests/fixture for scaffold shape
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `feat(SP-888): hydrate SP-* packets from GitHub issue (#384)`

## Do NOT

- Auto `spine batch start` on issue create
- Invent production File Scope without stubs/operator fill
- Replace packets with issue markdown at runtime
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
- **2026-11-22:** SKILL.md prelanded by SP-883; removed from mustChange.
