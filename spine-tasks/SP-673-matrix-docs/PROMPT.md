# Task: SP-673 — Document parametric matrix and execution-only tasks in operator runbook

**Created:** 2026-07-19
**Size:** S

## Review Level: 0 (None)

**Assessment:** Documentation-only task with no application code changes. Review Level 0 appropriate.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Partial #217, Partial #218 — Update the operator runbook to document how authors can use the new `## Matrix` parametric task syntax and the `Type: execute` frontmatter option. Include examples, caveats, and how to verify sub-lane status.

## Dependencies

- **Task:** SP-671 (matrix execution must be implemented so docs are accurate)
- **Task:** SP-672 (execution-only type must be implemented so docs are accurate)

## Context to Read First

- `spine-tasks/CONTEXT.md` — release context and next task ID
- `docs/adoption/operator-runbook.md` — target documentation
- `spine-tasks/SP-669-matrix-parse-planner/STATUS.md` — matrix syntax notes
- `spine-tasks/SP-670-matrix-substitute/STATUS.md` — substitution notes
- `spine-tasks/SP-671-matrix-execution/STATUS.md` — execution behavior notes
- `spine-tasks/SP-672-execution-only-type/STATUS.md` — execution-only behavior notes

## Environment

- **Workspace:** `docs/adoption/`
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `spine-tasks/SP-673-matrix-docs/STATUS.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] SP-671 and SP-672 are on `main`

### Step 1: Add matrix task documentation

- [ ] Add a section explaining `## Matrix` syntax (markdown table with parameter columns)
- [ ] Provide a complete example PROMPT snippet with `## Matrix` and `{matrix.var}` usage
- [ ] Explain how `spine plan` shows virtual sub-lanes
- [ ] Document how sub-lane status is reported and what happens when one row fails

**Artifacts:**
- `docs/adoption/operator-runbook.md` (modified)

### Step 2: Add execution-only task documentation

- [ ] Add a section explaining `Type: execute` frontmatter
- [ ] Provide an example PROMPT with `Type: execute` and a `runCommand` or shell command in steps
- [ ] Explain when to use execution-only vs. normal LLM tasks
- [ ] Document that lane isolation and contract verification still apply

**Artifacts:**
- `docs/adoption/operator-runbook.md` (modified)

### Step 3: Testing & Verification

- [ ] Run the FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify no application code changes (only docs)
- [ ] Fix any failures caused by doc-only changes (e.g., broken links)

### Step 4: Documentation & Delivery

- [ ] Update `STATUS.md` with discoveries
- [ ] Verify the runbook links correctly from README / docs index

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — add matrix and execution-only sections (also in `## File Scope`)

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` — add matrix/execute syntax if it exists
- `README.md` — link to new sections if relevant

## Completion Criteria

- [ ] Runbook documents matrix task syntax and behavior
- [ ] Runbook documents execution-only task syntax and behavior
- [ ] Full test suite passes
- [ ] STATUS.md updated

## Git Commit Convention

- `docs(SP-673): document matrix task syntax`
- `docs(SP-673): document execution-only task type`

## Do NOT

- Change application code
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

<!-- Workers add amendments here if issues discovered during execution. -->
