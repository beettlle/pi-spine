# Task: SP-395 — Issue draft body assembly

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Pure CLI helper module; reuses handoff redaction; issue #60 Tier 1b.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #60** Tier 1b: `src/cli/issue-draft.mjs` exports functions to build a GitHub issue markdown body from live project state — no CLI wiring yet (SP-396).

**Exports (minimum):**

- `buildIssueDraftBody({ projectRoot, issueType, title?, batchId? })` → `{ title, body, labels }`
- `formatIssueDraftMarkdown(sections)` — renders ## Summary, ## Environment, ## Commands run, ## Diagnosis, ## Journal excerpt, ## Expected, ## Actual

**Data sources (reuse existing helpers, no new reconcile path):**

- `reconcileBatch({ projectRoot, verbose: true })`
- Diagnose headline / suggestedCommand from reconciliation
- `spine doctor` equivalent via `runDoctorChecks` or existing doctor module
- Package version from `package.json` or `spine --version` pattern
- Journal tail (reuse handoff journal tail limit/pattern)
- `redactHandoffSecrets` / `redactHandoffText` from `src/cli/handoff.mjs`

**Label mapping:** `bug` | `enhancement` | `question` from `issueType` param.

## Dependencies

None

## Context to Read First

- GitHub issue #60
- `src/cli/handoff.mjs`
- `src/batch/reconcile.mjs`
- `spine-tasks/CONTEXT.md` Phase 48

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/cli/issue-draft.mjs`
- `tests/cli/issue-draft.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/issue-draft.test.mjs` |
| fileScopeMustChange | `src/cli/issue-draft.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/cli/issue-draft.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read handoff data assembly and redaction helpers
- [ ] Read operator checklist field list in spine-operator-cursor.mdc

### Step 1: Draft assembly module

- [ ] Implement `buildIssueDraftBody` collecting version, doctor summary, diagnose, journal tail
- [ ] Apply redaction to all string sections
- [ ] Map `issueType` → GitHub label name

### Step 2: Testing & Verification

- [ ] Unit tests with fixture projectRoot (git fixture + minimal batch state optional)
- [ ] Assert redaction removes fake `sk-` token patterns
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] JSDoc on exported functions

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] `buildIssueDraftBody` returns title, body, labels without CLI
- [ ] Tests pass; secrets redacted in output

## Git Commit Convention

- `feat(SP-395): complete Step N — description`
- `test(SP-395): description`

## Do NOT

- Wire `bin/spine.mjs` (SP-396)
- Call `gh issue create` (SP-396)
- Close GitHub issue #60

---

## Amendments (Added During Execution)
