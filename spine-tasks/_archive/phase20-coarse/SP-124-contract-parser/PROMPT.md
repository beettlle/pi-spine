# Task: SP-124 — Contract parser

**Created:** 2026-06-11
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** New parser module integrated into existing validatePrompt path.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Canonical Task Folder

```
spine-tasks/SP-124-contract-parser/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Parse ## Contract table from PROMPT.md; implement validateContract; integrate into validatePrompt based on contract.mode and legacy TP-* prefixes.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-123

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §4`
- `src/tasks/packet/parse-prompt.mjs`
- `src/tasks/packet/validate-prompt.mjs`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/tasks/packet/parse-prompt.mjs`
- `src/tasks/packet/validate-prompt.mjs`
- `src/tasks/packet/validate-contract.mjs`
- `src/tasks/packet/index.mjs`
- `tests/tasks/contract-parse.test.mjs`
- `test/fixtures/taskplane/FX-missing-contract/**`
- `test/fixtures/taskplane/FX-valid-contract/**`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-123)

### Step 1: Implement parseContract(markdown) → ParsedContract per hando


> **Plan-review checkpoint**
- [ ] Implement parseContract(markdown) → ParsedContract per handoff §4.3

### Step 2: Implement validateContract with mode and legacy prefix rules

- [ ] Implement validateContract with mode and legacy prefix rules

### Step 3: Extend validatePrompt to attach contract validation

- [ ] Extend validatePrompt to attach contract validation

### Step 4: Add fixtures FX-missing-contract and FX-valid-contract


> **Code review checkpoint**
- [ ] Add fixtures FX-missing-contract and FX-valid-contract

### Step 5: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Fix all failures

### Step 6: Documentation & Delivery

- [ ] Review docs per Documentation Requirements
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-124

## Git Commit Convention

- `feat(SP-124): complete Step N — description`
- `fix(SP-124): description`

## Do NOT

- Duplicate validation logic outside validate-contract.mjs
- Require Contract for TP-* legacy tasks

---

## Amendments (Added During Execution)
