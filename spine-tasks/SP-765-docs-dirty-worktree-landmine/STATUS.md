# SP-765: Document DirtyWorktree + tracked-ignore landmine — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-09-21
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-759/SP-764 .DONE
- [x] Dependencies satisfied

### Step 1: Document DirtyWorktree landmine
**Status:** ✅ Complete

- [x] Path-aware remediation in runbook
- [x] Tracked+gitignored warn docs
- [x] Cross-link issues

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract true
- [ ] Spot-check links

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create .DONE

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| SP-759 .DONE on main: `buildDirtyWorktreeSuggestedCommand` — `git checkout -- <dirty paths cap 5> && spine batch retry <id>`, fallback `git -C <laneWorktree> status --porcelain` | Documented in runbook/QR | `src/batch/diagnosis-primary-failure.mjs` |
| SP-764 .DONE on main: advisory `tracked-gitignored` preflight check + doctor advisory, `git rm -r --cached -- <paths cap 3>`, never blocks | Documented in runbook/QR | `src/config/preflight/tracked-gitignored.mjs` |
| SP-760 landed (#290): bare `python3` now allowlisted for gate evidence — runbook evidence table + stet-overview prose stale | Optional cross-link applied (PROMPT "Check If Affected") | `docs/adoption/operator-runbook.md`, `docs/stet-overview.md` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-21 | Task staged | PROMPT.md and STATUS.md created for v2.22.0 |
| 2026-09-21 | Step 0 complete | SP-759/SP-764 .DONE verified on main; SP-760 (#290) stale-allowlist cross-link applies |
| 2026-09-21 | Step 1 complete | Runbook §2.2 preflight table+landmine para, diagnosis quick map row (path-aware, #288), recovery row (tracked-ignore, #289), Phase A allowlist bare python3; QR preflight row + 2 troubleshooting rows; stet-overview allowlist line |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*

## Notes

- 2026-09-21: Contract fileScopeMustChange redirected to STATUS.md (preflight pre-landed after SP-767 doc touch). Docs File Scope steps still apply.
