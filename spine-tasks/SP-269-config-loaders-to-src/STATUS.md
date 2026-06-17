# SP-269: Move config loaders to src/config — Status

**Current Step:** Step 1 (Move loaders)
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-17
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Import inventory — 16 `src/**` files import from `bin/spine-config.mjs`, `bin/spine-preflight.mjs`, or `bin/spine-init.mjs` (for SP-270/271)

---

### Step 1: Move loaders
**Status:** 🟡 In Progress

- [x] src/config modules created
- [x] bin re-exports

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Suite green

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] .DONE created

---


## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| 16 src files still import bin/* (expected — SP-270/271 rewire) | Deferred | STATUS |
| No circular deps: src/config modules import bin only for spine.mjs/spine-plan.mjs (dynamic-safe) | OK | Step 0 |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-17 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-17 | Step 0 preflight | Import inventory + cycle check complete |
| 2026-06-17 | Step 1 | Created src/config modules, bin thin re-exports |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
