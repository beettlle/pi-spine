# Task: SP-216 — Extension slash-command tests

**Created:** 2026-06-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Integration tests for extension handlers; coverage gate ≥70% on slash-commands.ts.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-216-ship-extension-tests/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-06: Add integration tests for `/spine-*` slash command handlers in `extensions/spine/slash-commands.ts`. Enforce line coverage ≥70% (coverage config or documented gate).

## Dependencies

- **Task:** SP-214

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `extensions/spine/slash-commands.ts`
- `extensions/spine-orchestrator.ts`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-06

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `extensions/spine/slash-commands.ts`
- `extensions/spine-orchestrator.ts`
- `tests/extensions/**`
- `package.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `extensions/spine/slash-commands.ts` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Baseline extension coverage report
- [ ] List slash commands needing handler tests

### Step 1: Integration tests
> **Plan-review checkpoint**


- [ ] Add tests for `/spine-*` handlers
- [ ] Wire ≥70% line coverage gate for slash-commands.ts
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% repo; ≥70% slash-commands.ts
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Document coverage gate if new
- [ ] Create `.DONE`

## Completion Criteria

- [ ] slash-commands.ts line coverage ≥70%
- [ ] Integration tests for primary handlers
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-216): complete Step N — description`
- `fix(SP-216): description`
- `test(SP-216): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
