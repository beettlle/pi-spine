# Task: SP-817 — Replace micromatch with picomatch (clear braces high advisory)

**Created:** 2026-10-03
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** File-scope matching drives contract enforcement, planner overlap and cursor-rule selection. A behaviour change in glob matching could wrongly pass or fail contracts.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 0, Security: 1, Reversibility: 1
**Problem theory:** `npm audit --omit=dev` reports 2 high vulnerabilities (as of 2026-10-03): `braces` through `micromatch@^4.0.8`, the only runtime dependency, with no patched micromatch release. Every call site uses only `micromatch.isMatch(str, patterns, { dot: true })`. That call is equivalent to `picomatch(patterns, { dot: true })(str)`. No brace ranges are used. Call sites:
- `src/batch/contract-parse.mjs` ~202
- `src/batch/contract-prelanded.mjs` ~16
- `src/batch/contract-exec.mjs` ~267 (**500/500 lines — net change must be 0**)
- `src/planner/file-scope.mjs` ~267-278
- `src/config/cursor-rules/match-globs.mjs` ~123/127
- `src/config/cursor-rules/discover.mjs` ~100 (array pattern)
- `src/tasks/packet/validate-contract.mjs` ~238-239

Typings: `types/micromatch.d.ts`, listed in `tsconfig.batch.json` (~39). picomatch ships no types. `picomatch@4.0.7` is the current npm version.

## Mission

`micromatch` is gone from runtime dependencies, `npm audit --omit=dev` reports 0 high, and glob behaviour is unchanged.

1. **Dependency:** in `package.json` replace `"micromatch": "^4.0.8"` with `"picomatch": "^4.0.7"`, then run `npm install` to refresh `package-lock.json`. If any existing test shows a picomatch 4 behaviour difference, use `^2.3.2` and record the reason in Discoveries. Either way the audit must end at 0 high. If `brace-expansion` is still flagged transitively, it must resolve to ≥ 5.0.12.
2. **Call sites:** replace each `micromatch.isMatch(str, patterns, opts)` with `picomatch(patterns, opts)(str)`. Keep `{ dot: true }` explicit. `contract-exec.mjs` must keep exactly 500 lines.
3. **Types:** add `types/picomatch.d.ts` (default export: `(glob: string | string[], options?: { dot?: boolean }) => (input: string) => boolean`). Delete `types/micromatch.d.ts` and update `tsconfig.batch.json`.
4. **Regression test:** add a case to `tests/planner/file-scope-overlap.test.mjs` (or the closest existing matcher test) covering dotfiles (`.github/**`), `**` across directories, array patterns, and a negative match.

## Dependencies

- **None**

## Context to Read First

- `npm audit --omit=dev` output
- The 7 call sites above; `types/micromatch.d.ts`; `tsconfig.batch.json`
- `tests/planner/file-scope-overlap.test.mjs`, `tests/config/cursor-rules/match-globs.test.mjs`, `tests/tasks/contract-parse.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** npm registry access for `npm install`
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `package.json`
- `package-lock.json`
- `src/batch/contract-parse.mjs`
- `src/batch/contract-prelanded.mjs`
- `src/batch/contract-exec.mjs`
- `src/planner/file-scope.mjs`
- `src/config/cursor-rules/match-globs.mjs`
- `src/config/cursor-rules/discover.mjs`
- `src/tasks/packet/validate-contract.mjs`
- `types/picomatch.d.ts`
- `types/micromatch.d.ts`
- `tsconfig.batch.json`
- `tests/planner/file-scope-overlap.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && ! grep -rl micromatch src bin extensions types tsconfig.batch.json package.json && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/planner/file-scope-overlap.test.mjs tests/config/cursor-rules/match-globs.test.mjs tests/config/cursor-rules/discover.test.mjs tests/tasks/contract-parse.test.mjs tests/batch/contract-prelanded.test.mjs tests/config/loc-capstone-readiness.test.mjs` |
| fileScopeMustChange | `package.json`, `package-lock.json`, `types/picomatch.d.ts`, `tsconfig.batch.json` |

## Steps

### Step 0: Preflight

- [ ] Record the `npm audit --omit=dev` baseline in Discoveries
- [ ] `rg -n "micromatch" src bin extensions` lists the 7 call sites
- [ ] Dependencies satisfied

### Step 1: Swap dependency + call sites

- [ ] `package.json` and lockfile updated
- [ ] 7 call sites migrated; `contract-exec.mjs` still 500 lines
- [ ] Types swapped

**Artifacts:**
- `package.json`, `package-lock.json`, 7 `src/` files, `types/picomatch.d.ts` (new), `types/micromatch.d.ts` (deleted), `tsconfig.batch.json`

### Step 2: Regression test

- [ ] Dotfile / `**` / array / negative cases

**Artifacts:**
- `tests/planner/file-scope-overlap.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] `npm audit --omit=dev` shows 0 high (paste the summary into Discoveries)
- [ ] Run matcher-adjacent tests: `SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/config/cursor-rules/select.test.mjs tests/tasks/validate-contract-warn.test.mjs tests/batch/stub-contract-enforcement.test.mjs tests/batch/lane-merge-out-of-scope.test.mjs tests/batch/contract-base-satisfied.test.mjs`
- [ ] Run full suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-811 records it in the release notes)

**Check If Affected:**
- None

## Completion Criteria

- [ ] No `micromatch` in runtime code, types or `package.json`
- [ ] 0 high in `npm audit --omit=dev`
- [ ] Glob matching behaviour unchanged

## Git Commit Convention

- `fix(SP-817): replace micromatch with picomatch to clear braces advisory`

## Do NOT

- Touch the tracked root scratch files `prev_exec.mjs` / `cur_exec.mjs` (not linted, imported or shipped)
- Change any glob pattern semantics or add new matcher options
- Bump `@earendil-works/pi-coding-agent` (SP-818)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
