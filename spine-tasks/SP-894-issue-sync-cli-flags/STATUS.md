# SP-894: Issue-sync CLI flags — Status

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

- [ ] Dependencies satisfied (SP-893)
- [ ] Grep old flag call sites

---

### Step 1: Rename public flags
**Status:** ⚪ Pending

- [ ] --no-issue-sync
- [ ] --issue-label
- [ ] Tests + help

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

Release v2.35.0 — Partial #387 (CLI flags).

**File Scope note:** May touch `sync-on-land.mjs` / `integrate.mjs` for `noIssueSync` param rename. If so, serialize before SP-895 via deps (SP-895 depends on SP-894).

**2026-11-23 prelanded amend:** `board-select.mjs` removed from `fileScopeMustChange` (already on main via SP-891); still in File Scope for `--issue-label`.
