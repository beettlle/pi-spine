# Task: SP-299 — tasks analyze CLI delivery

**Created:** 2026-06-18
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** CLI wiring, warning checks, tests, and docs for spine tasks analyze.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Complete delivery slice for `spine tasks analyze` (parent SP-292). Re-land after batch `20260618T213001`: `src/tasks/analyze/index.mjs` is on `main` but `bin/spine-tasks.mjs` analyze subcommand and tests did not integrate.

Wire CLI with `--json`, implement warning-only checks (wave M-count, explore refs, deps/PROMPT drift), add tests and docs.

**Closes:** [#11](https://github.com/beettlle/pi-spine/issues/11)

## Dependencies

- **Task:** SP-298

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

```bash
spine settings set agents.worker.model cursor/auto
spine settings set agents.reviewer.model google/gemini-3.1-pro-preview
```

## Context to Read First

- `spine-tasks/SP-298-tasks-analyze-module/PROMPT.md`
- `src/tasks/analyze/index.mjs`
- `bin/spine-tasks.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-tasks.mjs`
- `src/tasks/analyze/index.mjs`
- `tests/tasks/analyze-cli.test.mjs`
- `docs/QUICK-REFERENCE.md`
- `docs/adoption/upstream-execution-workflow.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | bin/spine-tasks.mjs, tests/tasks/analyze-cli.test.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | tests/tasks/analyze-cli.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-298 analyze module merged

### Step 1: CLI and warnings

- [ ] Add `spine tasks analyze` with `--json`; exit 0 unless blocking issues
- [ ] Warning checks: wave M-count, explore refs, PROMPT/JSON deps drift

### Step 2: Testing & Verification

- [ ] `analyze-cli.test.mjs`: overlap blocking, clean passes, cycle fails, warnings-only exits 0
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] QUICK-REFERENCE + upstream-execution-workflow entries
- [ ] Close GitHub issue #11: `gh issue close 11 --comment "Fixed in SP-299: spine tasks analyze CLI wired on main with tests and docs."`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/QUICK-REFERENCE.md`
- `docs/adoption/upstream-execution-workflow.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #11 closed with comment referencing SP-299
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-299): complete Step N — description`
- `fix(SP-299): description`
- `test(SP-299): description`

## Do NOT

- Block batch start automatically (analyze is operator-opt-in)
---

## Amendments (Added During Execution)
