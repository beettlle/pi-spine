# SP-749: CI/arch guard against new @ts-nocheck — Status

**Current Step:** 2
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-05
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Notes

- Real-pi worker session (`SPINE_WORKER_RUNNER` set): plan/code review runs engine-side after `.DONE`; no in-worker review spawn (SP-194/195).
- Arch tests already run in CI via `npm test` (glob `tests/arch/*.test.mjs` in the root `test` script) — no `.github/workflows/ci.yml` change needed.

### Plan (Review Level 1)

`tests/arch/ts-nocheck-guard.test.mjs` with three tests:
1. **No new offenders** — recursively scan `src/**/*.mjs`; any file containing the `@ts-nocheck` directive must be in `NOCHECK_ALLOWLIST` (exact repo-relative paths, seeded from the 171 current offenders) or the test fails with a fix-instead-of-allowlist hint.
2. **Allowlist hygiene** — every allowlist entry must exist on disk *and* still carry the directive; stale entries (file removed, or nocheck removed by SP-750) fail, forcing the allowlist to shrink. This is the documented shrink mechanism.
3. **Scanner self-check** — synthetic fixtures in `os.tmpdir()` (no writes under `src/`, no new fixture files) prove the scanner detects leading and mid-file directives; plus a count assertion that the real scan finds exactly `NOCHECK_ALLOWLIST.size` files, so a regex regression cannot silently pass.

Step 2 sanity: add a temp `// @ts-nocheck` file under `src/`, observe the guard fail, delete it, observe green — documented here, nothing left failing.

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Enumerate current `src/**/*.mjs` with leading `// @ts-nocheck` — **171 files**, all with the directive as the literal first line (`grep -rl '@ts-nocheck' src/` == `grep -rl '^// @ts-nocheck' src/` == 171); full list captured in `/tmp/nocheck-allowlist.txt` and seeded into the guard's allowlist
- [x] Confirm how arch tests run in `npm test` / CI — root `test` script globs `tests/arch/*.test.mjs`, so a new arch test is picked up by `npm test` / `release:check` / CI automatically; lint (`eslint --max-warnings 0 src bin tests scripts`) also covers the new file

---

### Step 1: Guard test + allowlist
**Status:** ✅ Done

- [x] Add `tests/arch/ts-nocheck-guard.test.mjs` — 4 tests, all passing: (1) no new offenders outside allowlist, (2) allowlist hygiene (stale entries fail → forces shrink in SP-750), (3) scanner self-check on synthetic tmpdir tree (leading + mid-file + nested), (4) count parity between real src scan and allowlist size so a regex regression cannot silently pass
- [x] Seed allowlist from current offenders — 171 exact repo-relative paths, sorted, embedded in the test
- [x] Document how to shrink the allowlist — file-header comment (remove directive in source per SP-750, then prune the entry; hygiene test enforces it; never add new entries)

**Discovery:** block-comment header initially contained the literal glob `src/**/*.mjs` — the `*/` inside `**/` terminated the `/**` comment and broke parsing (`SyntaxError: Unexpected token '*'`). Rewrote the header to avoid `*/` sequences; worth knowing for future arch-test headers.

---

### Step 2: Testing & Verification
**Status:** ⚪ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Not Started

- [ ] Note Phase 0 landed for #266
- [ ] Create `.DONE`
