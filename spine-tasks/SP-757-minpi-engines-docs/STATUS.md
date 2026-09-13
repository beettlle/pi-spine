# SP-757: Document minPiVersion and engines — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress — Steps 0–1 complete
**Last Updated:** 2026-09-13
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read post-SP-755 `engines.node` and `pi.minPiVersion` from `package.json`
- [x] Dependencies satisfied

---

### Step 1: Document floors
**Status:** ✅ Complete

- [x] README: Node / pi minimums and peer expectation
- [x] npm-publish: note minPiVersion/engines for release operators
- [x] operator-runbook: short install/doctor row for the new floors

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract `testCommand` is `true`
- [ ] Version numbers in docs match `package.json`

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Pins after SP-755: `engines.node` = `>=22.19.0`, `pi.minPiVersion` = `0.80.0`, peer `@earendil-works/pi-coding-agent` = `*` (optional) with dev-tested pin `^0.85.1`; CI/release pi stubs echo `0.85.1` | Documented in all three scoped files | `package.json`, `.github/workflows/{ci,release}.yml` |
| `spine doctor` **warns** (does not fail) when pi < `minPiVersion` — `ok: true, warning: true` in the pi-version check | Docs say "warns", not "fails" | `src/doctor/run-doctor-checks.mjs:311-334` |
| `docs/QUICK-REFERENCE.md` has no install cheatsheet (only best-of-N dev-script prereq line "Node.js ≥ 22") | Not modified — PROMPT says prefer SP-756 ownership of QR sections | `docs/QUICK-REFERENCE.md` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-13 | Task staged | PROMPT.md and STATUS.md created for v2.21.0 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
