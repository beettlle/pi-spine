# SP-892: Extract issues github provider — Status

**Current Step:** Not started
**Status:** ⚪ Pending
**Last Updated:** 2026-11-23
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⚪ Pending

- [ ] Dependencies satisfied (SP-891)
- [ ] Identify extract surface

---

### Step 1: Extract provider
**Status:** ⚪ Pending

- [ ] Create providers/github.mjs
- [ ] Rewire sync-on-land

---

### Step 2: Testing & Verification
**Status:** ⚪ Pending

- [ ] Provider + sync tests
- [ ] Contract testCommand

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Pending

- [ ] Discoveries logged
- [ ] Create `.DONE`

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
| 2026-11-23 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

Release v2.35.0 — Partial #387 (provider extract).

**2026-11-23 prelanded amend:** `sync-on-land.mjs` removed from `fileScopeMustChange` (already on main via SP-890/SP-891); still in File Scope for extract rewire.
