# Task: SP-750 — Phase 1 high-risk modules: remove @ts-nocheck

**Created:** 2026-09-05
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Typing hot batch state/contract paths; JSDoc fixes may touch call sites. Must keep `npm test` green and expand `tsconfig.batch.json` carefully.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #266 — Phase 1: remove `@ts-nocheck` from high-risk modules (`src/batch/state-io.mjs`, `src/batch/state-guards.mjs`, `src/batch/contract-exec.mjs`, and `src/process/liveness.mjs` if still nocheck). Add JSDoc `@typedef` where needed so `tsc --project tsconfig.batch.json` passes with those files included. Shrink SP-749 allowlist entries for modules cleaned. Phase 2 (engine-lanes) and Phase 3 (reconcile) are out of scope — file follow-up issues at delivery if checklist rows remain.

## Dependencies

- **Task:** SP-749 (Phase 0 nocheck guard must land first so allowlist shrinks are testable)

## Context to Read First

- GitHub #266 — Phase 1 high-risk modules
- `spine-tasks/SP-749-ts-nocheck-ci-guard/PROMPT.md` — allowlist contract
- `tsconfig.batch.json`
- Target modules listed in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/state-io.mjs`
- `src/batch/state-guards.mjs`
- `src/batch/contract-exec.mjs`
- `src/process/liveness.mjs`
- `tsconfig.batch.json`
- `tests/arch/ts-nocheck-guard.test.mjs` (allowlist shrink only)
- `tests/batch/state-io.test.mjs` (create or extend if present)
- `tests/batch/contract-exec*.test.mjs` (extend if present)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && npx tsc --project tsconfig.batch.json --noEmit && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs` |
| fileScopeMustChange | `src/batch/state-io.mjs`, `src/batch/state-guards.mjs`, `src/batch/contract-exec.mjs`, `tsconfig.batch.json` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-749 guard exists and allowlist format
- [ ] Note which Phase 1 targets still have `@ts-nocheck`

### Step 1: Type Phase 1 modules + expand batch tsconfig

- [ ] Remove `@ts-nocheck` from Phase 1 targets; add JSDoc as needed
- [ ] Expand `tsconfig.batch.json` `include` for those modules
- [ ] Shrink arch allowlist for cleaned files
- [ ] Keep engine-lanes / reconcile nocheck untouched

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (includes `tsc --project tsconfig.batch.json`)
- [ ] Fix all failures
- [ ] Spot-check related batch tests if Contract suite is thin

### Step 3: Documentation & Delivery

- [ ] Update #266 checklist comment with burn-down % / Phase 2–3 follow-up issue links if filed
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- (none required — issue checklist is the tracker)

**Check If Affected:**

- `docs/QUICK-REFERENCE.md` — only if typecheck docs mention `tsconfig.batch.json` include list

## Completion Criteria

- [ ] Phase 1 modules pass `tsc --project tsconfig.batch.json` without nocheck
- [ ] `tsconfig.batch.json` include list expanded for Phase 1
- [ ] Arch guard still green; allowlist shrunk for cleaned files
- [ ] No regression in Contract / lint / typecheck
- [ ] Closes #266
- [ ] `.DONE` created

## Do NOT

- Type all of `src/batch/engine-lanes/*` (Phase 2 follow-up)
- Type reconcile/doctor clusters (Phase 3 follow-up)
- Migrate the repo to full TypeScript
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `feat(SP-750): type Phase 1 batch modules without @ts-nocheck (#266)`
