# Task: SP-749 — CI/arch guard against new @ts-nocheck

**Created:** 2026-09-05
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Architecture test + CI guard; allowlist of existing nocheck files must not regress silently. Low runtime blast radius.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Partial #266 — Phase 0 guardrail: fail CI / arch tests when a **new** `src/**/*.mjs` file introduces `// @ts-nocheck` (allowlist existing offenders). Do not remove nocheck from production modules in this task (Phase 1 is SP-750).

## Dependencies

- **None**

## Context to Read First

- GitHub #266 — Phase 0 guardrail section
- Existing arch tests under `tests/arch/` (pattern for allowlists)
- `tsconfig.batch.json` — current narrow include list (do not expand here)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/arch/ts-nocheck-guard.test.mjs`
- `tests/arch/fixtures/` (allowlist fixture if required)
- `.github/workflows/ci.yml` (only if arch tests are not already run by `npm test`)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs` |
| fileScopeMustChange | `tests/arch/ts-nocheck-guard.test.mjs` |
| fileScopeMustNotChange | `src/` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Enumerate current `src/**/*.mjs` with leading `// @ts-nocheck`
- [ ] Confirm how arch tests run in `npm test` / CI

### Step 1: Guard test + allowlist

- [ ] Add `tests/arch/ts-nocheck-guard.test.mjs` that fails when a non-allowlisted file gains `@ts-nocheck`
- [ ] Seed allowlist from current offenders (or snapshot hash) so existing debt does not fail CI
- [ ] Document how to shrink the allowlist in a short file comment

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures
- [ ] Sanity: temporarily adding nocheck to a new path would fail (documented in STATUS; do not leave failing)

### Step 3: Documentation & Delivery

- [ ] Comment on GitHub #266 with Phase 0 landed note (optional if network allowed; else STATUS note)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- (none — arch test is the deliverable; Phase 1 owns typing docs if any)

**Check If Affected:**

- `docs/QUICK-REFERENCE.md` — only if typecheck/CI guidance mentions nocheck policy

## Completion Criteria

- [ ] CI/arch fails on **new** `@ts-nocheck` in `src/`
- [ ] Existing nocheck files remain allowlisted (green)
- [ ] No `src/` nocheck removals in this task
- [ ] Partial #266
- [ ] `.DONE` created

## Do NOT

- Remove `@ts-nocheck` from production modules (SP-750)
- Expand `tsconfig.batch.json` includes (SP-750)
- Type engine-lanes / reconcile clusters (follow-up)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `test(SP-749): arch guard against new @ts-nocheck (#266)`
