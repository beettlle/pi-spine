# Task: SP-735 — Break batch-state-io and meta-reconstruct cycle variants

**Created:** 2026-08-28
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Remaining allowlist entries traverse `batch-state-io.mjs`, `batch-meta-reconstruct.mjs`, and journal rebuild paths.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #267 — Eliminate allowlisted cycles that include `batch-state-io.mjs -> readers/spine-state.mjs -> reconcile.mjs -> … -> batch-state-io.mjs` and `batch-meta-reconstruct.mjs` variants. Extract read-only diagnosis/state helpers to leaves that do not import resume/engine-lanes facades.

## Dependencies

- **Task:** SP-734 (merge/limbo cluster must shrink first)

## Context to Read First

- GitHub #267 — evidence table (11 allowlist strings)
- `tests/arch/import-cycles.test.mjs`
- `src/batch/batch-state-io.mjs`, `src/batch/batch-meta-reconstruct.mjs`
- `src/batch/resume-multi-validate.mjs`, `src/batch/readers/spine-state.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/batch-state-io.mjs`
- `src/batch/batch-meta-reconstruct.mjs`
- `src/batch/resume-multi-validate.mjs`
- `src/batch/readers/spine-state.mjs`
- `src/batch/journal-rebuild.mjs`
- `tests/arch/import-cycles.test.mjs`
- `tests/batch/resume-multi-validation.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/import-cycles.test.mjs tests/batch/resume-multi-validation.test.mjs` |
| fileScopeMustChange | `src/batch/batch-meta-reconstruct.mjs` |

## Amendments

- **2026-08-28:** Redirect `fileScopeMustChange` from `tests/arch/import-cycles.test.mjs` to `src/batch/batch-meta-reconstruct.mjs` — import-cycles allowlist already shrunk on `main` by SP-733 (`01ec37ed`); preflight pre-landed contract risk. Delivery proof is the state/meta-reconstruct leaf rewire.

## Steps

### Step 0: Preflight

- [ ] List remaining `ALLOWED_CLUSTER_CYCLES` after SP-733/734
- [ ] Confirm SP-734 integrated

### Step 1: Leaf extraction for state-io / meta-reconstruct edges

- [ ] Break imports so reconcile/readers paths do not close cycles through engine-lanes
- [ ] Keep reconcile.mjs free of `engine-lanes.mjs` imports

### Step 2: Shrink allowlist to zero or documented transitional set

- [ ] Remove state-io / meta-reconstruct cycle strings when eliminated

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**

- None required

## Completion Criteria

- [ ] No allowlisted cycles containing `batch-state-io.mjs` or `batch-meta-reconstruct.mjs` variants (or only explicitly documented transitional entries)
- [ ] import-cycles + resume validation tests pass
- [ ] `.DONE` created

## Do NOT

- Change batch-state persistence semantics
- Ship with growing allowlist
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `refactor(SP-735): break batch-state-io meta-reconstruct cycles (#267)`
