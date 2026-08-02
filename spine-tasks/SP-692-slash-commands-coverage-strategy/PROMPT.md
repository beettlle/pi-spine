# Task: SP-692 — Document slash-commands V8 coverage strategy

**Created:** 2026-08-02
**Size:** S

## Review Level: 0 (None)

**Assessment:** Strategy documentation only; keep isolation re-verify mitigation; no V8 engine rewrite.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Closes #245 — Document the approved long-term strategy for full-suite V8 under-reporting of `extensions/spine/slash-commands.ts` line % (FR-SHIP-06). Isolation re-verify (`FILE_COVERAGE_VERIFY_TESTS` + narrow include in `scripts/run-coverage.mjs`) remains the publish belt-and-suspenders until a proven attribution fix lands. Update `docs/release/test-layout-coverage-notes.md` and `docs/release/post-mortem-v2.12.1.md` §F6 / backlog row so operators know: (1) full-suite % can lie, (2) isolation re-verify is required for publish, (3) root-cause V8 attribution is deferred follow-up, not this patch.

**Do not** remove isolation re-verify. **Do not** attempt a Node V8 attribution rewrite in this task.

## Dependencies

- **None**

## Context to Read First

- `docs/release/test-layout-coverage-notes.md`
- `docs/release/post-mortem-v2.12.1.md` — §F6
- `scripts/coverage-policy.mjs` — `FILE_COVERAGE_THRESHOLDS`, `FILE_COVERAGE_VERIFY_TESTS` (read-only)
- `scripts/run-coverage.mjs` — isolation re-verify path (read-only)
- GitHub #245
- Related #222 family notes already in test-layout doc

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/test-layout-coverage-notes.md`
- `docs/release/post-mortem-v2.12.1.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/test-layout-coverage-notes.md`, `docs/release/post-mortem-v2.12.1.md` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `scripts/**`, `tests/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm isolation re-verify still present in `coverage-policy.mjs` / `run-coverage.mjs` (read-only)
- [ ] Note current full-suite vs narrow-include % figures from post-mortem §F6

### Step 1: Document strategy

- [ ] Expand `docs/release/test-layout-coverage-notes.md` with a dedicated slash-commands / FR-SHIP-06 section: symptom, isolation re-verify, approved strategy (keep re-verify; prefer root-cause when proven; do not weaken per-file floor)
- [ ] Update post-mortem §F6 and engineering backlog row for #245 to record **strategy documented in v2.12.2**; root-cause remains open follow-up if not solved
- [ ] Cross-link notes ↔ post-mortem ↔ issue #245

### Step 2: Testing & Verification

- [ ] Confirm both docs contain the strategy language (docs-only contract)
- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test` from repo root

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/release/test-layout-coverage-notes.md`
- `docs/release/post-mortem-v2.12.1.md`

**Check If Affected:**
- `docs/release/npm-publish.md` — only if coverage gate wording needs a one-line pointer

## Completion Criteria

- [ ] Strategy documented: isolation re-verify stays; V8 root-cause deferred with explicit rationale
- [ ] Post-mortem §F6 / backlog updated for strategy path
- [ ] No removal or weakening of `FILE_COVERAGE_VERIFY_TESTS` / per-file floor

## Do NOT

- Rewrite Node V8 coverage attribution or remove isolation re-verify
- Lower `FILE_COVERAGE_THRESHOLDS` for slash-commands
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip the Testing step

## Git Commit Convention

- `docs(SP-692): document slash-commands V8 coverage strategy (#245)`
