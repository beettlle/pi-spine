# SP-895: Journal events issues.synced — Status

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

- [ ] Dependencies satisfied (SP-894)
- [ ] Grep old journal type strings

---

### Step 1: Rename journal types
**Status:** ⚪ Pending

- [ ] Emit issues.synced / issues.sync_failed
- [ ] Update tests

---

### Step 2: Testing & Verification
**Status:** ⚪ Pending

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

Release v2.35.0 — Partial #387 (journal). Depends on SP-894 to avoid File Scope clash on sync-on-land.

**2026-11-23 prelanded amend:** sync-on-land + tests removed from `fileScopeMustChange` (already on main via SP-893/SP-894); still in File Scope for journal event rename. Contract mustChange → this STATUS.md.
