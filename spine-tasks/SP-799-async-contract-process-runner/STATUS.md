# SP-799: Async contract shell runner — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-09-28
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Current runner read
- [x] Tree-kill behavior confirmed
- [x] Dependencies satisfied

### Step 1: `runShellCommandAsync`
**Status:** ✅ Complete

- [x] Detached spawn + capped capture
- [x] Timeout tree-kill
- [x] Spawn errors → 127
- [x] Shared shell resolution (helper moved to contract-spawn.mjs; contract-exec.mjs 498→497 lines)

### Step 2: Tests
**Status:** 🟡 In Progress

- [ ] Event-loop
- [ ] Timeout grandchild
- [ ] Output cap
- [ ] Missing shell

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact on `runContractTestCommand` = HIGH (5 upstream, 3 processes via `verifyContract`). Mitigated: change to it is behavior-preserving helper extraction only; existing contract tests lock behavior. |

## Blockers

_None._
