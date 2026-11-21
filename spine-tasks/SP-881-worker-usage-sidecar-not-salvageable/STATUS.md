# SP-881: Exclude worker-usage.json from salvage and dirty scope — Status

**Current Step:** Complete
**Status:** ✅ Finished (outside-spine hotfix)
**Last Updated:** 2026-11-21 (outside-spine hotfix)
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Map resolveScopedDirtyPaths → salvage → diagnosis headline
- [x] Confirm sidecar basename constant sync with runner/queue

---

### Step 1: Exclude sidecar from dirty/salvage
**Status:** ✅ Complete

- [x] Filter worker-usage.json from scoped dirty
- [x] Add GITIGNORED_ARTIFACT_MARKERS (+ .gitignore if needed)
- [x] Keep metric sidecar read working

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Only-sidecar dirty → not salvage-fail
- [x] Existing usage metric tests still green

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract testCommand
- [x] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries in STATUS
- [x] Create .DONE

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
| 2026-11-21 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

Release v2.33.1 emergency patch.
Implemented outside spine batch (batch thrash on #380). Sidecar excluded from dirty/salvage; .gitignore + markers.
