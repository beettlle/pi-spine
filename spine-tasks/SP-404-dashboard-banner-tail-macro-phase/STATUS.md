# SP-404: Dashboard banner tail macro-phase — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read GitHub issue #68
- [x] Dependencies satisfied (SP-403 complete)

---

### Step 1: Preflight
**Status:** ✅ Complete

- [x] Read SP-403 headline/macroPhase fields exposed to dashboard snapshot

---

### Step 2: Banner model tail states
**Status:** 🟡 In Progress

- [x] Update `buildBannerModel` to use macro-phase label when no active lane tasks
- [x] Use neutral/finalizing badge instead of green running when appropriate
- [x] Keep green running badge when `hasRunningTasks`

---

### Step 3: UI contract tests
**Status:** 🟡 In Progress

- [x] Add snapshot fixture for tail state banner model
- [x] Assert banner subline or badge reflects merge/gate activity

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77%)

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [x] Docs updated (none required)

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `badge-finalizing` class added to model; dashboard.js/CSS rendering deferred to SP-406 | Noted | `src/dashboard/view.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-01 | Task staged | PROMPT.md and STATUS.md created for GitHub #68 |
| 2026-07-01 | Step 2–3 implementation | `resolveBannerBadge`, tail-state ui-contract tests |

---

## Blockers

*None*

---

## Notes

Tier 1 banner model only per file scope. SP-406 will wire `badgeLabel`/`subline` into dashboard.js rendering.
