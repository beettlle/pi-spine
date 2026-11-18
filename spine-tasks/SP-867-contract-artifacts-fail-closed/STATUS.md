# SP-867: Contract: reject .. in artifacts; fix ** globs; fail-closed on git diff failure — Status

**Current Step:** Step 1 — Fail-closed contract checks
**Status:** 🔄 Executing
**Last Updated:** 2026-11-18
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

Blast radius (GitNexus): `impact`/`context` for `findArtifactMatch`/`verifyContract` → target not found in index (risk UNKNOWN; resolved via text search per AGENTS rule). `findArtifactMatch` is module-private to `src/batch/contract-exec.mjs` with 4 call sites (3 prelanded/resume/base-satisfied matcher callbacks + artifactsMustExist loop). `verifyContract` (contract-exec.mjs) is wrapped by `verifyContract` (contract-verify.mjs auto-stage + matrix subst) and called from `src/batch/engine-lanes/review-final.mjs:292` and `src/batch/engine-lanes/matrix-run.mjs:322`. Existing contract-verify test fixtures use real git repos, so fail-closed git-diff gating scoped to contracts that declare `fileScopeMustNotChange` leaves them green.

- [x] GitNexus impact on `findArtifactMatch` / `verifyContract`; report blast radius in STATUS
- [x] `rg -n "findArtifactMatch|artifactsMustExist|fileScopeMustNotChange" src/batch/contract-exec.mjs tests/batch/`

---

### Step 1: Fail-closed contract checks
**Status:** ✅ Complete

- [x] Reject `..` / out-of-worktree artifact patterns
- [x] Fix `**` glob search root
- [x] Fail `fileScopeMustNotChange` when git diff fails

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Add/adjust unit tests for the three behaviors

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged (runbook owned by SP-865)
- [ ] Create `spine-tasks/SP-867-contract-artifacts-fail-closed/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-18 | Step 1 complete | findArtifactMatch rejects ../abs + containment guard, glob root = literal prefix, git diff failure fails must-not-change; smoke-tested all behaviors |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
