# SP-799: Async contract shell runner — Status

**Current Step:** Done
**Status:** ✅ Complete
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
**Status:** ✅ Complete

- [x] Event-loop
- [x] Timeout grandchild
- [x] Output cap
- [x] Missing shell

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Lint (`eslint --max-warnings 0` clean)
- [x] Contract `testCommand` (19/19 pass, incl. typecheck)
- [x] Batch suite (`test:batch` 1556/1556 pass, 164 s)
- [x] Coverage gate (`coverage:check` 89.99% ≥ 77%)
- [x] Fix all failures — none needed

testCommand run with `SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER` unset per PROMPT. GitNexus `detect_changes` vs main: 1 symbol touched (`runContractTestCommand`, helper-extraction only), 1 affected process (`verifyContract`) — matches Discovery #1.

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact on `runContractTestCommand` = HIGH (5 upstream, 3 processes via `verifyContract`). Mitigated: change to it is behavior-preserving helper extraction only; existing contract tests lock behavior. |
| 2 | Step 3 `detect_changes` vs main: 1 symbol touched (`runContractTestCommand`), 1 affected process (`verifyContract`) — no unexpected blast radius. |
| 3 | `terminateProcessTree`'s POSIX negative-pid group kill requires a group leader; `detached: true` on spawn makes the child the leader, so the SIGTERM reaches `sleep 30 &` grandchildren without tree-walk races. |

## Blockers

_None._
