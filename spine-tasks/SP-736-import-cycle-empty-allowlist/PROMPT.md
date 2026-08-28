# Task: SP-736 — Empty ALLOWED_CLUSTER_CYCLES and close #267

**Created:** 2026-08-28
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Capstone verification task; empty allowlist and assert zero unexpected batch cycles.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #267 — Set `ALLOWED_CLUSTER_CYCLES` to empty (or only documented transitional cycles with expiry comment). Assert `tests/arch/import-cycles.test.mjs` passes with no allowlisted engine-lanes / state-io clusters. Add regression assertion that unexpected cycles fail the test.

## Dependencies

- **Task:** SP-733 (resume leaf)
- **Task:** SP-734 (limbo leaf)
- **Task:** SP-735 (state-io leaf)

## Context to Read First

- GitHub #267 — acceptance criteria (empty allowlist)
- `tests/arch/import-cycles.test.mjs`
- #263 — CI wiring note (out of scope unless trivial)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/arch/import-cycles.test.mjs`
- `src/batch/engine-lanes.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/import-cycles.test.mjs tests/batch/post-merge-limbo.test.mjs tests/batch/detached-start-land-loop.test.mjs tests/batch/resume-multi-integration.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes.mjs` |

## Amendments

- **2026-08-28:** Redirect `fileScopeMustChange` from `tests/arch/import-cycles.test.mjs` to `src/batch/engine-lanes.mjs` — import-cycles already changed on `main` by SP-733 (`01ec37ed`); preflight pre-landed contract risk. Empty-allowlist proof remains via Contract `testCommand`; facade edit documents cycle-free ownership.

## Steps

### Step 0: Preflight

- [ ] Confirm SP-733, SP-734, SP-735 are `.DONE` on `main`
- [ ] Run import-cycles test; capture any remaining cycles

### Step 1: Empty allowlist

- [ ] Clear `ALLOWED_CLUSTER_CYCLES` (or leave empty Set with comment)
- [ ] Tighten test: unexpected cluster cycles fail with actionable message

### Step 2: Final cycle sweep

- [ ] Fix any remaining import edges surfaced when allowlist is empty
- [ ] `engine-lanes.mjs` facade must not participate in batch import cycles

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**

- `spine-tasks/CONTEXT.md` — Phase 85 exit / #267 closed note

## Completion Criteria

- [ ] `ALLOWED_CLUSTER_CYCLES` empty
- [ ] import-cycles + limbo/resume integration tests pass
- [ ] Closes #267
- [ ] `.DONE` created

## Do NOT

- Re-open evidence/gate triangle cycles
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `test(SP-736): empty import-cycle allowlist (#267)`
