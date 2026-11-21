# SP-881: Exclude worker-usage.json from salvage and dirty scope — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-21
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Map resolveScopedDirtyPaths → salvage → diagnosis headline
- [ ] Confirm sidecar basename constant sync with runner/queue

---

### Step 1: Exclude sidecar from dirty/salvage
**Status:** ⬜ Not Started

- [ ] Filter worker-usage.json from scoped dirty
- [ ] Add GITIGNORED_ARTIFACT_MARKERS (+ .gitignore if needed)
- [ ] Keep metric sidecar read working

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Only-sidecar dirty → not salvage-fail
- [ ] Existing usage metric tests still green

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract testCommand
- [ ] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries in STATUS
- [ ] Create .DONE

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
