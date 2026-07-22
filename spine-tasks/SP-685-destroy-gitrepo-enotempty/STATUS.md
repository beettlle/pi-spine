# SP-685: Harden destroyGitRepo ENOTEMPTY teardown — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** ✅ Completed
**Last Updated:** 2026-07-22
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ In Progress
- [x] Confirm destroyGitRepo behavior
- [x] Find ad-hoc rm on temp git roots in File Scope

### Step 1: Harden shared teardown + route hot suites
**Status:** ✅ Completed
- [x] Bounded retries + swallow residual ENOTEMPTY
- [x] Limbo/SIGTERM use destroyGitRepo only
- [x] Document macOS Spotlight/AV caveat

### Step 2: Testing & Verification
**Status:** ✅ Completed
- [x] git-fixture-teardown regression
- [x] Contract testCommand
- [x] Fix scoped failures

### Step 3: Documentation & Delivery
**Status:** ✅ Completed
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `destroyGitRepo` already uses `maxRetries: 10` and swallows `ENOTEMPTY`. | Keep existing behavior; add injection point for testability and improve comment. |
| File Scope suites (attached-post-merge-sigterm, post-merge-limbo, -regression, -20260630) already tear down via `destroyGitRepo`. | No migration needed; verify no ad-hoc `rm` remains. |

## Completion Criteria

- [x] Shared destroyGitRepo teardown for in-scope temp git fixtures
- [x] Residual ENOTEMPTY does not fail the suite
- [x] Helper documents macOS caveat
- [x] Regression covers swallow behavior

## Blockers

_None yet._
