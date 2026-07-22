# SP-685: Harden destroyGitRepo ENOTEMPTY teardown — Status

**Current Step:** Step 0 — Preflight
**Status:** ⬜ Not Started
**Last Updated:** 2026-07-22
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ⬜ Not Started
- [ ] Confirm destroyGitRepo behavior
- [ ] Find ad-hoc rm on temp git roots in File Scope

### Step 1: Harden shared teardown + route hot suites
**Status:** ⬜ Not Started
- [ ] Bounded retries + swallow residual ENOTEMPTY
- [ ] Limbo/SIGTERM use destroyGitRepo only
- [ ] Document macOS Spotlight/AV caveat

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] git-fixture-teardown regression
- [ ] Contract testCommand
- [ ] Fix scoped failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| | |

## Completion Criteria

- [ ] Shared destroyGitRepo teardown for in-scope temp git fixtures
- [ ] Residual ENOTEMPTY does not fail the suite
- [ ] Helper documents macOS caveat
- [ ] Regression covers swallow behavior

## Blockers

_None yet._
