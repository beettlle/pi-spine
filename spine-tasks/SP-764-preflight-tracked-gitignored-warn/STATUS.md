# SP-764: Preflight warn tracked gitignored paths — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🟡 In Progress
**Last Updated:** 2026-09-21
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm no existing tracked+gitignored check
- [x] Dependencies satisfied

### Step 1: Advisory check
**Status:** ✅ Complete

- [x] Implement git ls-files -i check
- [x] Wire preflight+doctor warning
- [x] Remediation git rm --cached
- [x] Unit tests with temp repo

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint
- [x] Run Contract testCommand
- [x] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create .DONE

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Bare `git ls-files -i` is fatal on modern git ("must be used with either -o or -c"); used `-i -c --exclude-standard` | Resolved in check module | `src/config/preflight/tracked-gitignored.mjs` |
| `git add -A` never tracks ignored paths — #289 signal only exists when a path was committed before being ignored | Fixture uses `git add -f` to reproduce | `tests/config/preflight-tracked-gitignored.test.mjs` |
| Minimal PROMPT fixture needs `## Do NOT` + Testing step to pass tasks-validate/plan | Resolved in fixture | `tests/config/preflight-tracked-gitignored.test.mjs` |
| New src/ files must not carry `@ts-nocheck` (SP-749 arch guard); tsc reaches the module transitively via tsconfig.batch.json import chains, so the module is fully JSDoc-typed | Resolved | `src/config/preflight/tracked-gitignored.mjs` |
| Full `npm test` has 43 pre-existing failures (batch start/spine-run) from worker-session nested-spawn guards; verified identical at base commit a717e7ff | Out of scope (environment, not regression) | — |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-21 | Task staged | PROMPT.md and STATUS.md created for v2.22.0 |
| 2026-09-21 | Step 0 complete | No existing general tracked+gitignored check (only metrics-specific doctor advisory); committed 2f6310a0 |
| 2026-09-21 | Plan review checkpoint | `spine_review_step` returned skipped (SP-195) — engine runs review after .DONE |
| 2026-09-21 | Step 1 complete | Check module + preflight/doctor wiring + 8 unit tests, all passing |
| 2026-09-21 | Step 2 complete | Contract testCommand exit 0 (lint + typecheck + 8/8 tests); doctor/config/guard suites 313/313; fixed unused-import lint + ts-nocheck guard |
| 2026-09-21 | npm test | 2589/2634 pass; 43 failures verified pre-existing at base commit (worker-session env), not regressions |

---

## Blockers

*None*

---

## Notes

### Step 1 plan (Review Level 1)

1. New `src/config/preflight/tracked-gitignored.mjs`:
   - `listTrackedGitignoredPaths(projectRoot)` — runs `git ls-files -i -c --exclude-standard` (verified: bare `-i` is fatal on git 2.54 — "must be used with either -o or -c" — so `-c` is explicit; `-c` matches #289 intent of tracked files); returns `{paths, error}`.
   - `checkTrackedGitignoredWarn(ctx)` — preflight check id `tracked-gitignored`; always `ok: true`; `warning: true` + bounded 3-path preview + `details.paths` + `suggestedCommand` = `git rm -r --cached -- <paths>` when non-empty; quiet skip on git failure (advisory must not block).
   - `buildTrackedGitignoredDoctorCheck(ctx)` — doctor-shaped `{label, ok: true, warning?, detail, suggestedCommand?}`.
2. Wire `src/config/spine-preflight-lib.mjs`: re-export + push into `runBatchPreflight` after `checkGitClean`.
3. Wire `src/doctor/run-doctor-checks.mjs`: push inside `isInsideGitRepo` block after the run-metrics tracked advisory (closely related existing check).
4. Tests `tests/config/preflight-tracked-gitignored.test.mjs` (initGitRepo fixture): quiet case; warn case (file committed before .gitignore entry); bounded preview >3 paths; non-git-dir skip; doctor builder; `runBatchPreflight` integration (preflight.ok stays true); `runDoctorChecks` integration (label + warning, issueCount unchanged).

Key behavior verified locally: a file tracked **before** being added to `.gitignore` is exactly what `ls-files -i -c` reports; `git add -A`-fresh ignored files are never tracked and produce an empty list.
