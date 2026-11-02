# Task: SP-854 — Dependency security: pi-coding-agent 1.4.0, npm audit has no high findings

**Created:** 2026-11-01
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** The dev/peer pi runtime drives every worker and reviewer test path. A bump can change runtime behavior; leaving it keeps a high-severity `undici` advisory in the tree.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 1, Reversibility: 0
**Problem theory:** `npm audit` on `main` (2026-11-01) reports 1 high (`undici`, transitive via `@earendil-works/pi-coding-agent`) and 5 moderate (`minimatch` via pi-coding-agent; `eslint`, `@eslint/config-array`, `@eslint-community/eslint-utils`). `package-lock.json` pins `@earendil-works/pi-coding-agent` 1.1.0; 1.4.0 is published and depends on `undici` 8.10.2. `package.json` devDependency `^1.0.1` already allows 1.4.0. `eslint` 10.11.0 → 10.14.0 and `globals` 17.12.0 → 17.14.0 are in-range minors. TypeScript 7, `@types/node` 26 and `typebox` 1.4 are deferred (toolchain major / no threshold).

## Mission

`npm audit --audit-level=high` exits 0 on `main`:

1. Update the lockfile to `@earendil-works/pi-coding-agent` 1.4.0 and raise the devDependency floor to `^1.4.0`.
2. Update `eslint` and `globals` to their latest in-range minors.
3. If `undici` is still flagged high after step 1, add an `overrides` entry pinning a fixed `undici` version and record why in STATUS Discoveries.
4. Leave `typescript`, `@types/node`, and `typebox` unchanged. Record remaining moderate advisories (and whether a non-major fix exists) in STATUS Discoveries.

## Dependencies

- **None**

## Context to Read First

- `package.json` (`devDependencies`, `peerDependencies`)
- `npm audit` and `npm outdated` output on the lane before changes

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** npm registry access
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `package.json`
- `package-lock.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && npm audit --audit-level=high && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/review-spawn.test.mjs tests/batch/worker-prompt-rules.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| fileScopeMustChange | `package-lock.json` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Record `npm audit` summary and `npm outdated` before changes in STATUS Discoveries
- [ ] `npm view @earendil-works/pi-coding-agent@1.4.0 dependencies` — confirm the `undici` version

### Step 1: Bump

- [ ] `npm install --save-dev @earendil-works/pi-coding-agent@^1.4.0 eslint@^10.14.0 globals@^17.14.0`
- [ ] `npm audit --audit-level=high` exits 0; if not, add an `undici` override and re-check

**Artifacts:**
- `package.json`, `package-lock.json` (modified)

### Step 2: Testing & Verification

- [ ] Run Contract `testCommand`
- [ ] Fix all failures; if pi 1.4.0 breaks tests in a way that needs `src/` changes, stop and record a blocker (out of File Scope)

### Step 3: Documentation & Delivery

- [ ] Discoveries: before/after audit counts, remaining moderates and their fix availability
- [ ] Create `spine-tasks/SP-854-deps-pi-coding-agent-audit/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `README.md` pi version requirements (record in Discoveries; do not edit)

## Completion Criteria

- [ ] `npm audit --audit-level=high` exits 0
- [ ] Lockfile has `@earendil-works/pi-coding-agent` 1.4.0

## Git Commit Convention

- `fix(SP-854): bump pi-coding-agent to 1.4.0; clear high audit finding`

## Do NOT

- Bump `typescript`, `@types/node`, or `typebox`
- Run `npm audit fix --force`
- Edit `src/` or `bin/`
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
