# SP-757: Document minPiVersion and engines — Status

**Current Step:** Complete
**Status:** ✅ Done — all steps complete
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
**Status:** ✅ Complete

- [x] Contract `testCommand` is `true`
- [x] Version numbers in docs match `package.json`

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Create `.DONE`

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
| First `npm test` run failed 1 test (`spine run all dry-run matches pending-filtered batch start`) — root cause is the SP-482 nested-batch guard: `SPINE_IS_WORKER=1` set in worker env blocks the test's spawned `spine run`. With the guard unset: single file 2/2 pass, full suite **2618/2618 pass, 0 fail**. Environment artifact, not a regression. | Resolved — full suite green | `tests/spine-run.test.mjs:83`, SP-482 guard |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-13 | Task staged | PROMPT.md and STATUS.md created for v2.21.0 |
| 2026-09-13 | Step 0 | Pins captured; SP-755 confirmed landed (0739cf7d, wave-0 integrate 39bba516) |
| 2026-09-13 | Step 1 | README prerequisites table + floors note; npm-publish "Version floors" section + checklist row; runbook §1 floors row |
| 2026-09-13 | Step 2 | Version-match check 9/9 OK; `npm test` 2618/2618 pass (SPINE_IS_WORKER guard unset — see Discoveries) |
| 2026-09-13 | Step 3 | `.DONE` created; completion criteria met |

## Completion Criteria

- [x] Docs match Wave A pins (`engines.node` >=22.19.0, `pi.minPiVersion` 0.80.0, peer dev pin ^0.85.1)
- [x] Partial #285 (docs)

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
