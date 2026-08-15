# Task: SP-706 — Review parser fence audit

**Created:** 2026-08-15
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Audit-first on existing `parseReviewVerdict` / `parseFinalReviewVerdict`; GitNexus blast is HIGH so do not invent verdicts.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #213 — Audit spine review/plan structured-output parsers for markdown fences and embedded JSON. Inventory `parseReviewVerdict` and `parseFinalReviewVerdict` in `src/batch/review-shared.mjs` (fence-wrapped ` ```json ` already exists). Add regression fixtures in `tests/batch/review-shared.test.mjs` for fence-wrapped, preamble+JSON, and embedded-object cases. Extract a shared brace/fence helper **only** if two or more parsers fail the same proven case. Fail-closed: garbage must keep `verdict: null` — do not invent PASS/REVISE/APPROVE/REPLAN. Do not change parsers that already have adequate coverage without a failing fixture.

## Dependencies

- **None**

## Context to Read First

- `src/batch/review-shared.mjs` — `parseReviewVerdict`, `parseFinalReviewVerdict`
- `tests/batch/review-shared.test.mjs`
- GitHub #213
- `spine-tasks/_authoring/release-v2.14.0/manifest.md` — HIGH blast note

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review-shared.mjs`
- `tests/batch/review-shared.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/review-shared.test.mjs` |
| fileScopeMustChange | `tests/batch/review-shared.test.mjs` |
| fileScopeMustNotChange | `src/batch/journal.mjs` |

## Steps

### Step 0: Preflight

- [ ] Inventory `parseReviewVerdict` and `parseFinalReviewVerdict` fence/heading paths
- [ ] List existing fixtures in `tests/batch/review-shared.test.mjs` (do not duplicate)

### Step 1: Fixtures and proven fixes only

- [ ] Add fixtures: fence-wrapped JSON, preamble then JSON fence, embedded extra object / trailing prose
- [ ] Where a fixture fails, fix the parser fail-closed (explicit null, not heuristic salvage)
- [ ] Share a small helper only if **both** parsers need the same fix
- [ ] Leave working paths unchanged when fixtures already pass

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- _(none — audit note may live in GitHub #213 comment or STATUS Discoveries)_

**Check If Affected:**
- `tests/batch/review.test.mjs` — additional parse coverage; do not edit unless a fixture belongs there (keep File Scope)

## Completion Criteria

- [ ] Fixtures cover fence, preamble+JSON, and embedded-object cases
- [ ] No invented verdicts from garbage input
- [ ] Shared helper only if 2+ parsers needed the same fix
- [ ] Scoped tests pass

## Do NOT

- Invent PASS/REVISE/APPROVE/REPLAN from unparseable text
- Copy llm-use helpers wholesale
- Rewrite parsers that already pass the new fixtures
- Edit `src/batch/journal.mjs` (SP-705)
- Edit `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-706): review parser fence and embedded JSON audit (#213)`
