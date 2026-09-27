# Task: SP-778 — Same-major dev dependency hygiene (v2.24.0)

**Created:** 2026-09-26
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Dev-toolchain bumps (typebox schemas, `@types/node` surface, eslint rules, pi-coding-agent peer) can surface new typecheck/lint findings; no runtime dependency changes.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 1, Reversibility: 0
**Problem theory:** v2.24.0 Phase 1 drift check: four dev dependencies trail their latest same-major release. Operator chose to include same-major hygiene and defer toolchain majors (TypeScript 7, `@types/node` 26).

## Mission

Bump these `devDependencies` in `package.json` and refresh `package-lock.json`:

| Package | From | To |
|---------|------|-----|
| `@earendil-works/pi-coding-agent` | `^0.87.0` | `^0.87.1` |
| `eslint` | `^10.10.0` | `^10.11.0` |
| `typebox` | `1.3.30` | `1.3.34` (keep exact pin) |
| `@types/node` | `^22.19.18` | latest `22.x` (e.g. `^22.20.4`; stay on major 22) |

Update the three docs that state the pi-coding-agent dev pin (`^0.87.0` → `^0.87.1`). Leave `peerDependencies` (`*`), `engines.node`, `pi.minPiVersion`, `typescript` (6.0.3), and `dependencies` unchanged. `npm run lint && npm run typecheck` must stay clean and `npm audit` must stay at 0 high/critical.

## Dependencies

- **None**

## Context to Read First

- `package.json` — `devDependencies`, `peerDependencies`
- `docs/release/npm-publish.md` — Version floors table (~line 110) + checklist (~line 138)
- `README.md` — peer pin sentence (~line 52)
- `docs/adoption/operator-runbook.md` — Version floors paragraph (~line 102)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** npm registry access
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`) — worker-session env trips the SP-482 nested-spawn guard inside test subprocesses

## File Scope

- `package.json`
- `package-lock.json`
- `README.md`
- `docs/release/npm-publish.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/extensions/*.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| fileScopeMustChange | `package.json`, `package-lock.json`, `docs/release/npm-publish.md` |

## Steps

### Step 0: Preflight

- [ ] Record `npm outdated` output for the four packages
- [ ] Confirm latest same-major versions: `npm view <pkg> version` / `npm view @types/node@22 version`
- [ ] Dependencies satisfied

### Step 1: Bump dev dependencies

- [ ] Edit `devDependencies` ranges in `package.json` per the Mission table
- [ ] `npm install` to refresh `package-lock.json` (no `npm update` of unrelated packages; no `--force`)
- [ ] `npm audit` — 0 high/critical
- [ ] `npm run lint && npm run typecheck` clean; findings outside File Scope → log under Blockers and stop

**Artifacts:**
- `package.json` (modified)
- `package-lock.json` (modified)

### Step 2: Update version-pin docs

- [ ] `README.md`, `docs/release/npm-publish.md`, `docs/adoption/operator-runbook.md` — pi-coding-agent dev pin `^0.87.0` → `^0.87.1`
- [ ] `rg -n '\^0\.87\.0' README.md docs` returns nothing

**Artifacts:**
- `README.md`, `docs/release/npm-publish.md`, `docs/adoption/operator-runbook.md` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run full suite with worker env unset: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md (resolved versions, any fixes)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `README.md` — peer dev pin sentence
- `docs/release/npm-publish.md` — Version floors table + publish checklist pin
- `docs/adoption/operator-runbook.md` — Version floors paragraph

**Check If Affected:**

- `CHANGELOG.md` — only if the repo maintains unreleased entries by hand

## Completion Criteria

- [ ] Four dev deps on latest same-major versions; lockfile refreshed
- [ ] `npm audit` 0 high/critical
- [ ] Docs match the new pi-coding-agent dev pin
- [ ] Contract green

## Git Commit Convention

- `chore(SP-778): bump same-major dev dependencies`

## Do NOT

- Upgrade `typescript` to 7.x or `@types/node` beyond 22.x
- Change `peerDependencies`, `engines`, `pi.minPiVersion`, or runtime `dependencies`
- Edit `src/**`, `bin/**`, `extensions/**`, or `tests/**` — if a bump surfaces lint/typecheck findings there, log them under Blockers and stop (operator re-scopes)
- Edit `tsconfig.batch.json` or `tests/arch/ts-nocheck-guard.test.mjs` (SP-774 owns them this wave)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
