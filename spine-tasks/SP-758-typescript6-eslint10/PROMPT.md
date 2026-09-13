# Task: SP-758 — Wave B: TypeScript 6 + ESLint 10 + globals 17

**Created:** 2026-09-13
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Toolchain majors can produce widespread typecheck/lint failures across `src/`, `bin/`, `extension/`, and batch tsconfigs. Keep `@types/node` on the 22 line.
**Score:** 6/8 — Blast radius: 4, Pattern novelty: 2, Security: 0, Reversibility: 1
**Problem theory:** #285 Wave B — TypeScript 5.6→6.x and ESLint 9→10 are required for the minor enhancement slot after Wave A peer security landed.

## Mission

Partial #285 — Complete **Wave B** only: bump TypeScript to `6.0.x` (not 7), ESLint to 10.x, `globals` to 17.x; keep `@types/node` on `^22.x`; fix `npm run typecheck` and `npm run lint` (`--max-warnings 0`) across package + extension/batch tsconfigs. Embed a short migration note in File Scope docs listed below. Do **not** bump GitHub Actions majors (Wave C deferred).

## Dependencies

- **Task:** SP-755 (peer/lockfile baseline before toolchain majors)
- **Task:** SP-757 (serialize `docs/release/npm-publish.md` after engines docs)

## Context to Read First

- `Parent split: SP-755 — Wave A peer/audit`
- `package.json` — typescript/eslint/globals pins
- `tsconfig.json`, `tsconfig.batch.json`, `eslint.config.js`
- GitHub #285 — Wave B acceptance
- ESLint 10 migration notes (official) — skim only if lint fails

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** Network for npm install

## File Scope

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tsconfig.batch.json`
- `eslint.config.js`
- `src/**` — only type/lint fixes required for green typecheck/lint
- `bin/**` — only as required for green typecheck/lint
- `extension/**` — only as required for green typecheck/lint
- `tests/**` — only as required for green typecheck/lint
- `docs/release/npm-publish.md` — short Wave B toolchain note (versions only)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && npm run lint` |
| fileScopeMustChange | `package.json`, `package-lock.json`, `eslint.config.js` |

> **Why not full `release:check` in Contract:** Same SP-755 lesson — full-suite contract verify flakes on unrelated timing tests under lane contention. Prove toolchain green via typecheck+lint; post-integrate `release:check` on `main` is the merge gate.

## Steps

### Step 0: Preflight

- [ ] Confirm SP-755 pins on `main` (pi-coding-agent ^0.85.1)
- [ ] Record current typescript/eslint/globals versions in STATUS.md
- [ ] Dependencies satisfied

### Step 1: Toolchain bump

- [ ] Bump `typescript` to 6.0.x (not 7); `eslint` to 10.x; `globals` to 17.x; refresh lockfile
- [ ] Keep `@types/node` on 22.x
- [ ] Adjust flat ESLint config for v10 breaking changes as needed
- [ ] Fix typecheck errors in package + extension/batch projects
- [ ] `npm run lint` clean with `--max-warnings 0`

**Artifacts:**
- `package.json` (modified)
- `package-lock.json` (modified)
- `eslint.config.js` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (`release:check`)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Brief Wave B version note in `docs/release/npm-publish.md`
- [ ] Discoveries logged (any deferred TS7 items)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/release/npm-publish.md` — toolchain versions for Wave B *(also in File Scope)*

**Check If Affected:**
- `README.md` — only if it pins typescript/eslint versions (prefer SP-757 for engines)

## Completion Criteria

- [ ] TypeScript 6.x + ESLint 10 + globals 17 on `main`
- [ ] `npm run release:check` green
- [ ] Partial #285 Wave B (Wave C remains open/deferred)

## Git Commit Convention

- `chore(SP-758): TypeScript 6 and ESLint 10 toolchain (#285)`

## Do NOT

- Migrate to TypeScript 7
- Bump `@types/node` to 24/26
- Bump Actions majors (Wave C)
- Mid-release edit `.spine/` agent model pins
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
