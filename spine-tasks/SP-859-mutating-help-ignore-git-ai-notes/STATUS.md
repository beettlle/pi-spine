# SP-859: mutating-help ignore git-ai notes — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-11-16
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact / callers of `snapshotProject` if exported; otherwise document it is test-local
- [x] `rg -n "for-each-ref|snapshotProject|refs/notes" tests/cli/mutating-help.test.mjs`

### Step 1: Filter + test
**Status:** ✅ Complete

- [x] Ignore `refs/notes/*` and `.git/ai/**` in the side-effect snapshot
- [x] Synthetic notes-ref regression assertion

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Contract `testCommand` passing
- [x] All failures fixed

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `snapshotProject` is test-local (not exported): GitNexus impact upstream = 0 callers, risk UNKNOWN; text search confirms the only uses are lines 92/183/191/201/211 of `tests/cli/mutating-help.test.mjs` | Documented (no upstream blast radius) | tests/cli/mutating-help.test.mjs |
| `.git/ai/**` was already excluded: `snapshotProject`'s `walk` skips `.git` wholesale; the actual false-failure source was the `git for-each-ref` listing including `refs/notes/ai`. Fix filters `refs/notes/*` lines and documents the `.git/ai` exclusion. No broad silence — `refs/heads/side-effect` regression assertion proves ordinary refs still fail the snapshot | Fixed | tests/cli/mutating-help.test.mjs |
| SP-854 STATUS independently documented this exact flake (git-ai annotates `refs/notes/ai` asynchronously in tmpdir fixtures; reproduces at baseline b80ca53e) — confirms problem theory | Confirmed | spine-tasks/SP-854.../STATUS.md |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |

## Blockers

*None*

## Completion Criteria
- [x] Snapshot ignores `refs/notes/*` and `.git/ai/**`
- [x] Synthetic notes-ref case does not fail the equality helper
- [x] Contract `testCommand` exits 0
