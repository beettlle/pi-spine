# SP-781: Matrix row runtime metachar guard — Status

**Current Step:** Step 2 (Testing & Verification)
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Reproduce injection at HEAD — row value `alpha; printf PWNED > pwned.txt` substitutes into runCommand; `/bin/sh -c` runs the injected second command (pwned.txt created); `isRefusedContractMetacharCommand(substituted)` = true
- [x] Dependencies satisfied (none)

### Step 1: Runtime guard
**Status:** ✅ Done

- [x] Guard after substitution, before spawn — `isRefusedContractMetacharCommand(command)` ternary short-circuits before `runShellInDir` (matrix-run.mjs execute branch)
- [x] Refused-row result + message — flows through the existing `run.exitCode !== 0` failed-row path; `formatMatrixRowRefusedMetacharMessage` names row id + detected issue ("matrix row command refused before spawn")
- [x] `&&` allowed — same #268 grammar; unit + e2e assertions
- [x] Injection tests (no spawn, journaled) — matrix-row-command-guard.test.mjs: `;`, `$(`, backtick, lone `&` all refused; `pwned.txt`/`out/` absent in row worktree; `matrix.sub_lane.failed` journaled
- [x] `contract-matrix-subst` case — metachar-in-value: substitution textual, verifyContract refuses before spawn

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

_None yet._

## Blockers

_None._
