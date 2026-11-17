# SP-858: Docs git-ai peer notes — Status

**Current Step:** Step 1 — Docs
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-17
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Find existing release-check / pre-publish sections; note where git-ai and peer version belong

### Step 1: Docs
**Status:** ✅ Complete

- [x] git-ai `refs/notes` hazard + SP-859 ignore + temporary workaround
- [x] Peer `pi-coding-agent` 1.5.2 note for this release

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
| npm-publish.md peer row/checklist said dev pin `^1.0.1` but package.json + lockfile are `^1.4.0`/1.4.0 since SP-854 (v2.30.0, ad96c638) — stale doc | Fixed in Step 1 (precondition for an accurate 1.5.2 peer note) | docs/release/npm-publish.md |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |

## Blockers

*None*
