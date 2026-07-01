# Task: SP-398 — Contract comma-in-backtick path parse fix

**Created:** 2026-07-01
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Parser bug in contract path lists causes false `fileScopeMustChange` failures; batch SP-396 exhausted final review despite valid lane diffs.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix **GitHub issue #61**: when `fileScopeMustChange` lists multiple paths inside **one** backtick pair with comma separators (e.g. `` `bin/a.mjs,bin/b.mjs` ``), contract verification fails with malformed path tokens even when git diffs contain both files.

**Required behavior:**

1. `parseContractPathList` in `src/tasks/packet/parse-prompt.mjs` parses comma-separated paths inside a single backtick wrapper as two paths (not `` `path-a` `` and `` path-b` ``).
2. `validateContract` warns (or errors in `required` mode) when a contract cell uses comma-in-single-backtick form, pointing authors to per-path backticks.
3. Regression tests cover SP-396 reproduction (`bin/spine-issue.mjs`, `bin/spine.mjs`) and existing per-path backtick behavior in `contract-parse.test.mjs`.

**Closes:** [#61](https://github.com/beettlle/pi-spine/issues/61)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #61
- Batch `20260630T232548` journal (`contract.verified` for SP-396)
- `tests/tasks/contract-parse.test.mjs` (valid per-path backtick example)
- Related: #56 (pre-landed scope — SP-373/SP-374)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/tasks/packet/parse-prompt.mjs`
- `src/tasks/packet/validate-contract.mjs`
- `tests/tasks/contract-parse.test.mjs`
- `skills/create-spine-tasks/references/contract-template.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/tasks/contract-parse.test.mjs` |
| fileScopeMustChange | `src/tasks/packet/parse-prompt.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/tasks/contract-parse.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #61 and batch `20260630T232548` `contract.verified` payload for SP-396
- [ ] Trace `parseContractPathList` → `parseContractScalar` and `verifyStubFileScopeMustChange` path matching

### Step 1: Fix path list parsing

- [ ] When the raw cell is a single backtick-wrapped value containing commas, strip wrapper then split on commas (or equivalent correct parse)
- [ ] Preserve existing behavior for per-path backticks, plain comma lists, and `see File Scope`

### Step 2: Authoring guard

- [ ] Add validate/preflight warning for comma-in-single-backtick `fileScopeMustChange` / `artifactsMustExist` cells
- [ ] Update `contract-template.md` with per-path backtick example (discourage `` `a,b` ``)

### Step 3: Testing & Verification

- [ ] Add regression tests for comma-in-backtick and SP-396 paths
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 4: Delivery

- [ ] Close GitHub issue #61
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `skills/create-spine-tasks/references/contract-template.md`

**Check If Affected:**

- `docs/adoption/operator-runbook.md` (contract authoring § only if validate message surfaces in preflight)

## Completion Criteria

- [ ] Comma-in-backtick contract cells parse to correct path list
- [ ] SP-396-style paths verify when diffs exist on lane branch
- [ ] Tests pass with coverage gate
- [ ] Issue #61 closed

## Git Commit Convention

- `feat(SP-398): complete Step N — description`
- `fix(SP-398): description`
- `test(SP-398): description`

## Do NOT

- Change pre-landed scope semantics (#56 — SP-373/SP-374)
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
