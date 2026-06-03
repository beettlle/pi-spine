# Task: SP-061 — Code coverage 77% policy (foundation)

**Created:** 2026-06-03
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Establish a **minimum 77% line coverage** policy for all spine-orchestrated **code-related** work in this repo and in consumer projects using pi-spine. Wire coverage into npm scripts, CI, spine-config defaults, agent standing orders, and the `create-spine-tasks` skill so workers and reviewers treat coverage as a completion gate — not an optional nice-to-have.

## Dependencies

- **None**

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `templates/agents/worker.md`, `templates/agents/reviewer.md`
- `skills/create-spine-tasks/SKILL.md`, `skills/create-spine-tasks/references/prompt-template.md`
- `docs/PRD.md` §7.5 (FR-WORK), §14 (agent contracts)
- `.github/workflows/ci.yml`, `package.json`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `package.json`
- `.github/workflows/ci.yml`
- `templates/spine-config.json`
- `templates/agents/worker.md`
- `templates/agents/reviewer.md`
- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/prompt-template.md`
- `docs/PRD.md`
- `tests/coverage/*.test.mjs` (new, if needed for threshold wiring)

## Steps

### Step 0: Preflight

- [ ] Read current `npm test` and CI workflow; confirm Node ≥22 test runner capabilities
- [ ] Inventory existing coverage tooling (none expected)

### Step 1: Coverage tooling + npm scripts

> **Plan-review checkpoint**

- [ ] Add `test:coverage` script (Node `--experimental-test-coverage` and/or `c8` — pick one approach that works with existing `.test.mjs` layout)
- [ ] Add `coverage:check` (or fold into `test:coverage`) that **fails exit non-zero** when line coverage **< 77%** for in-scope source (`src/`, `bin/`, `extensions/`)
- [ ] Document threshold constant (e.g. `COVERAGE_THRESHOLD=77`) in one place

**Artifacts:**
- `package.json` (modified)
- coverage config file if required (new)

### Step 2: CI + spine-config defaults

- [ ] CI runs coverage check on push/PR (after typecheck + stub tests, or integrated)
- [ ] `templates/spine-config.json`: populate `testing.testWithCoverage` with the coverage command; add brief comment in template or docs
- [ ] Ensure `spine init` consumers get a usable default (empty string OK only if documented fallback)

**Artifacts:**
- `.github/workflows/ci.yml` (modified)
- `templates/spine-config.json` (modified)

### Step 3: Agent + skill policy text

> **Code review checkpoint**

- [ ] **Worker** (`templates/agents/worker.md`): standing order — code-related tasks must maintain **≥77% line coverage** on changed/in-scope modules; run `testing.testWithCoverage` (or project equivalent) before `.DONE`
- [ ] **Reviewer** (`templates/agents/reviewer.md`): code reviews must verify coverage meets threshold for changed code paths (or REVISE with missing tests)
- [ ] **create-spine-tasks** skill + prompt template: Testing step references coverage gate; PROMPT.md tasks with code deliverables include coverage verification checkbox

**Artifacts:**
- `templates/agents/worker.md`, `templates/agents/reviewer.md` (modified)
- `skills/create-spine-tasks/SKILL.md`, `references/prompt-template.md` (modified)

### Step 4: PRD + verification

- [ ] Add normative coverage requirement to `docs/PRD.md` (worker/reviewer or testing section): **77% minimum line coverage** for code-related spine task deliverables
- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage check locally; confirm pass at ≥77% or add tests until threshold met

## Documentation Requirements

**Must Update:**
- `docs/PRD.md` — coverage policy paragraph

**Check If Affected:**
- `README.md` — CI / testing section if it mentions test commands only

## Completion Criteria

- [ ] All steps complete
- [ ] CI enforces 77% line coverage on in-scope source
- [ ] Worker, reviewer, and skill templates document the policy
- [ ] Full test suite green

## Git Commit Convention

- **Step completion:** `feat(SP-061): complete Step N — description`
- **Tests:** `test(SP-061): …`

## Do NOT

- Lower the 77% threshold without explicit operator approval
- Scope coverage to unrelated directories (e.g. `spine-tasks/`, `.worktrees/`)
- Block this task on SP-062+ agent prompt expansions (coverage sections only here)

## Amendments

_(Workers only.)_
