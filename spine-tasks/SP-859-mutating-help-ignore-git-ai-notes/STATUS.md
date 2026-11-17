# SP-859: mutating-help ignore git-ai notes — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-16
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact / callers of `snapshotProject` if exported; otherwise document it is test-local
- [ ] `rg -n "for-each-ref|snapshotProject|refs/notes" tests/cli/mutating-help.test.mjs`

### Step 1: Filter + test
**Status:** ⬜ Not Started

- [ ] Ignore `refs/notes/*` and `.git/ai/**` in the side-effect snapshot
- [ ] Synthetic notes-ref regression assertion

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract `testCommand` passing
- [ ] All failures fixed

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |

## Blockers

*None*
