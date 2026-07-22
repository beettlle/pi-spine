# Task: SP-686 — Coverage-safe metrics redaction test layout

**Created:** 2026-07-22
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Test-layout guidance + keep usage redaction asserts in existing file; root V8 attribution may remain tooling-side.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #222 — Full-suite V8 coverage for `slash-commands.ts` collapsed when usage-redaction asserts lived in a **separate** test file under `tests/batch/`. Mitigation already folded asserts into `tests/batch/run-metrics.test.mjs` (`b691e64a`). Close the issue by: (1) documenting the layout constraint so future metrics/redaction tests do not reintroduce a separate file that false-fails `release:check`, (2) keeping usage-count asserts present in the inlined file, (3) recording whether this is treated as tooling/attribution guidance vs a proven product coverage hole.

**Do not** re-split into `run-metrics-usage-redaction.test.mjs` unless a minimal fixture proves the collapse is fixed.

## Dependencies

- **None**

## Context to Read First

- `tests/batch/run-metrics.test.mjs` — redaction + usage asserts
- `src/batch/metrics.mjs`
- GitHub #222
- Commits `c5e7d70e` (isolate — insufficient), `b691e64a` (fold — green)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/run-metrics.test.mjs`
- `docs/release/test-layout-coverage-notes.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/run-metrics.test.mjs` |
| fileScopeMustChange | `tests/batch/run-metrics.test.mjs`, `docs/release/test-layout-coverage-notes.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm usage redaction asserts remain in `run-metrics.test.mjs` (not a separate file)
- [ ] Note any remaining `run-metrics-usage*` separate files to remove or avoid

### Step 1: Document layout + keep asserts green

- [ ] Add a short `docs/release/test-layout-coverage-notes.md` explaining: do not isolate small metrics/redaction unit tests into new files that correlate with unrelated module coverage collapse under full `release:check`; prefer inlining into the owning suite until tooling is proven safe
- [ ] Strengthen in-file comment above the redaction/usage test pointing at #222 and the doc
- [ ] Keep usage-count asserts present so #222 regression path stays covered

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/release/test-layout-coverage-notes.md`

**Check If Affected:**
- `docs/release/npm-publish.md` — optional link to layout notes

## Completion Criteria

- [ ] Usage redaction asserts remain in `run-metrics.test.mjs`
- [ ] Layout guidance doc exists and is referenced from the test comment
- [ ] Documented stance: tooling/attribution guidance (or proven product fix if discovered)

## Do NOT

- Reintroduce a separate usage-redaction test file without proving full-suite coverage stays green
- Rewrite the coverage gate scripts unless a minimal proven fix is found inside File Scope
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-686): document coverage-safe metrics test layout (#222)`
