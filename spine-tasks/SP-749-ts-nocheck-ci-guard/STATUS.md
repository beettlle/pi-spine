# SP-749: CI/arch guard against new @ts-nocheck — Status

**Current Step:** 3 (complete)
**Status:** ✅ Done
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
**Status:** ✅ Done (see verification notes)

- [x] Run lint: `npm run lint` — pass, exit 0
- [x] Run Contract `testCommand` (`npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs`) — pass, exit 0, 4/4 arch tests green
- [x] Fix all failures — one test-side fix during development: expected array in the scanner self-check missed the `nested/` prefix; header block comment also initially contained a literal `*/` (see Step 1 discovery)
- [x] Sanity: created `src/__sp749-sanity-tmp.mjs` with a leading `// @ts-nocheck` — guard failed as designed ("no new @ts-nocheck outside the allowlist" ✖ + count-parity ✖); deleted the file, re-ran → 4/4 pass. Nothing left failing, `src/` unchanged in git.

**Full `npm test` note:** `SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test` → 2574 tests, 2531 pass, **43 fail — all pre-existing** subprocess-heavy batch/engine integration tests (engine.test.mjs, sequence-resume, batch-start-wave, spine-run, etc.), zero in `tests/arch/`. Verified pre-existing: at lane base 7f569e57 (throwaway worktree, before this task's commit) `tests/spine-run.test.mjs` already fails 2/2 and `tests/batch/integration-abc.test.mjs` fails 2/3. All 4 new arch tests pass inside the full-suite run. Contract testCommand is green; the 43 base failures are out of scope for SP-749.

---

### Step 3: Documentation & Delivery
**Status:** ✅ Done

- [x] Note Phase 0 landed for #266 — commented: https://github.com/beettlle/pi-spine/issues/266#issuecomment-5553479301
- [x] Create `.DONE`

---

### Completion Criteria

- [x] CI/arch fails on **new** `@ts-nocheck` in `src/` — "no new @ts-nocheck outside the allowlist in src/" (runs via `tests/arch/*.test.mjs` glob in `npm test` / `release:check` / CI)
- [x] Existing nocheck files remain allowlisted (green) — 171 entries, count-parity test proves scanner↔allowlist agreement
- [x] No `src/` nocheck removals in this task — git diff touches only `tests/arch/ts-nocheck-guard.test.mjs` + task packet
- [x] Partial #266 — Phase 0 note posted (link above)
- [x] `.DONE` created

**Verification status:** lint ✅ (exit 0) · typecheck ✅ (exit 0) · Contract testCommand ✅ (exit 0, 4/4) · full `npm test`: 2531/2574 pass; 43 failures verified pre-existing at lane base 7f569e57 (see Step 2 note), zero in `tests/arch/`.
