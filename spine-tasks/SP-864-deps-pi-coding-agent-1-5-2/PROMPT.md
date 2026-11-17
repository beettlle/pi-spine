# Task: SP-864 — Lockfile: @earendil-works/pi-coding-agent 1.5.2 (+ eslint 10.15 optional)

**Created:** 2026-11-16
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Peer runtime drift (lockfile 1.4.0 vs installed pi 1.5.2) can make worker/reviewer tests diverge from the operator host.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** Phase 1 intake for v2.31.0: `npm outdated` shows `@earendil-works/pi-coding-agent` 1.4.0 → 1.5.2 (wanted 1.5.2). Peer is `*`; `devDependencies` floor is `^1.4.0`. Host `pi` is already 1.5.2. Minor profile peer ≥1-minor threshold fires — include this hygiene packet. `npm audit`: 0 high/critical, 4 moderate. TypeScript 7 / `@types/node` 26 / typebox 1.4 deferred.

## Mission

Lockfile and floor match pi 1.5.2 used on the release host:

1. Raise `devDependencies["@earendil-works/pi-coding-agent"]` to `^1.5.2` and refresh `package-lock.json` to 1.5.2.
2. Optionally bump `eslint` to the latest in-range 10.15.x in the same install if it is a clean patch/minor with no src changes.
3. Leave `typescript`, `@types/node`, and `typebox` unchanged.
4. `npm audit --audit-level=high` exits 0 after the bump.

## Dependencies

- **None**

## Context to Read First

- `package.json` (`devDependencies`, `peerDependencies`)
- `npm outdated` / `npm audit` on the lane before changes
- Prior pattern: `spine-tasks/SP-854-deps-pi-coding-agent-audit/PROMPT.md`

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
| testCommand | `npm run lint && npm run typecheck && npm audit --audit-level=high && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/review-spawn.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| fileScopeMustChange | `package-lock.json` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Record `npm audit` summary and `npm outdated` before changes in STATUS Discoveries
- [ ] `npm view @earendil-works/pi-coding-agent@1.5.2 version`

### Step 1: Bump

- [ ] `npm install --save-dev @earendil-works/pi-coding-agent@^1.5.2` (and `eslint@^10.15.0` if taking the optional patch)
- [ ] Confirm lockfile entry is 1.5.2; `npm audit --audit-level=high` exits 0

**Artifacts:**
- `package.json`, `package-lock.json` (modified)

### Step 2: Testing & Verification

- [ ] Run Contract `testCommand`
- [ ] Fix all failures; if 1.5.2 requires `src/` changes, stop and record a blocker (out of File Scope)

### Step 3: Documentation & Delivery

- [ ] Discoveries: before/after versions, remaining moderates
- [ ] Create `spine-tasks/SP-864-deps-pi-coding-agent-1-5-2/.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-858 owns release-gate peer note)

**Check If Affected:**
- `README.md` pi version requirements (record in Discoveries; do not edit)

## Completion Criteria

- [ ] Lockfile has `@earendil-works/pi-coding-agent` 1.5.2
- [ ] `npm audit --audit-level=high` exits 0
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `chore(SP-864): bump pi-coding-agent lockfile to 1.5.2`

## Do NOT

- Bump `typescript`, `@types/node`, or `typebox`
- Run `npm audit fix --force`
- Edit `src/` or `bin/`
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
