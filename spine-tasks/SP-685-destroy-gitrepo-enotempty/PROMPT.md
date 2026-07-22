# Task: SP-685 — Harden destroyGitRepo ENOTEMPTY teardown

**Created:** 2026-07-22
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Shared test-helper harden + hot-path suite routing; mitigations partially landed (`7dee5096`).
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #223 — Temp git fixture teardown must not fail `release:check` after assertions pass when macOS Spotlight/AV or parallel workers leave `.git/refs` / `objects/pack` briefly non-empty. Finish acceptance: shared `destroyGitRepo` is the teardown path for limbo/SIGTERM (and any remaining initGitRepo hot paths that still use ad-hoc `rm`), residual `ENOTEMPTY` after bounded retries is non-fatal, and helper documents the macOS caveat.

**Already on main:** `7dee5096` (maxRetries 10 + swallow residual ENOTEMPTY); limbo/SIGTERM suites already import `destroyGitRepo`.

## Dependencies

- **None**

## Context to Read First

- `tests/helpers/git-fixture.mjs` — `destroyGitRepo`
- `tests/batch/attached-post-merge-sigterm.test.mjs`
- `tests/batch/post-merge-limbo*.test.mjs`
- GitHub #223

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/helpers/git-fixture.mjs`
- `tests/helpers/git-fixture-teardown.test.mjs`
- `tests/batch/attached-post-merge-sigterm.test.mjs`
- `tests/batch/post-merge-limbo.test.mjs`
- `tests/batch/post-merge-limbo-regression.test.mjs`
- `tests/batch/post-merge-limbo-20260630.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/helpers/git-fixture-teardown.test.mjs tests/batch/attached-post-merge-sigterm.test.mjs tests/batch/post-merge-limbo.test.mjs` |
| fileScopeMustChange | `tests/helpers/git-fixture.mjs`, `tests/helpers/git-fixture-teardown.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm current `destroyGitRepo` behavior and which limbo/SIGTERM teardowns still use ad-hoc `rm`/`rmSync`
- [ ] Note any `initGitRepo` callers in File Scope suites missing `destroyGitRepo`

### Step 1: Harden shared teardown + route hot suites

- [ ] Keep/strengthen `destroyGitRepo`: bounded retries + residual `ENOTEMPTY` does not fail the suite after successful assertions
- [ ] Ensure File Scope limbo/SIGTERM suites tear down only via `destroyGitRepo` (no ad-hoc recursive rm on temp git roots)
- [ ] Document macOS Spotlight/AV caveat in the helper comment

### Step 2: Testing & Verification

- [ ] Add `tests/helpers/git-fixture-teardown.test.mjs` proving residual `ENOTEMPTY` after retries is swallowed (mock or fixture)
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (helper comment is in-file)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — release:check flake notes (optional)

## Completion Criteria

- [ ] Shared `destroyGitRepo` is the teardown path for in-scope temp git fixtures
- [ ] Residual `ENOTEMPTY` after bounded retries does not fail the suite
- [ ] Helper documents macOS Spotlight/AV caveat
- [ ] Unit/regression covers swallow behavior

## Do NOT

- Mass-migrate every `fs.rmSync` under `tests/batch/**` (only temp **git** fixtures / File Scope suites)
- Change product `src/**` batch engine code
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-685): harden destroyGitRepo ENOTEMPTY teardown (#223)`
