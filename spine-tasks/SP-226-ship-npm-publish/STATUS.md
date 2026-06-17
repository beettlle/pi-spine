# SP-226: npm publish execution — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-06-17
**Review Level:** 1 (Plan Only)
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-242 Done — `.DONE` present (2026-06-14)
- [x] Obtain operator approval — approved 2026-06-16 (Cursor session)

---

### Step 1: Publish (human-gated)
**Status:** ✅ Complete

- [x] Record approval timestamp in release docs
- [x] Bump `package.json` to `1.0.0` (initial); hotfix to `1.0.1` for missing `scripts/coverage-parse.mjs` in npm tarball
- [x] `npm publish --access public` — **1.0.0** published manually (operator, browser 2FA); **1.0.1** published via GitHub Actions (`publish.yml`, secret `NPMSECRET`)
- [x] Post-publish smoke — `npm install -g pi-spine@1.0.1`, `spine version`, `spine doctor` pass (2026-06-17)
- [ ] Tag `v1.0.1` in git (optional; not created)
- [ ] Deprecate `pi-spine@1.0.0` on npm (operator 2FA OTP pending)

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] FULL test suite — 880/880 pass (`SPINE_WORKER_STUB=1 npm test`, 2026-06-17)
- [x] Coverage gate — 86.75% line (threshold 77%)

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Release docs updated (`docs/release/v1.0-checklist.md`, `docs/release/npm-publish.md`)
- [x] `.DONE` created

---

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| 2026-06-17 | `1.0.0` tarball omitted `scripts/coverage-parse.mjs` — global `spine doctor` crashed | Fixed in `1.0.1` via `package.json` `files` |
| 2026-06-17 | Local `npm publish` requires 2FA OTP; CI Automation token works | `publish.yml` uses `NPMSECRET` + `--ignore-scripts` |
| 2026-06-17 | `prepublishOnly` flaky in CI (reconcile tests) | CI runs tests separately; publish skips scripts |

---

## Notes

- **npm latest:** `pi-spine@1.0.1` — https://www.npmjs.com/package/pi-spine
- **pi.dev:** https://pi.dev/packages/pi-spine (listed; SP-255 doc sync)
- **CI publish:** `.github/workflows/publish.yml` after green CI on `main`
