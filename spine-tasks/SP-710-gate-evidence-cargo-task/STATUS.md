# SP-710: Gate evidence allow cargo/task + safe PATH prefix — Status

**Current Step:** Step 4: Documentation & Delivery
**Status:** Complete
**Last Updated:** 2026-08-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

## Step 0: Preflight

**Status:** Complete

- [x] Read #254 rejection messages: `[rejected] evidence command contains shell variable expansion` for `PATH="$HOME/.cargo/bin:$PATH" cargo test`; `cargo`/`task` rejected as unallowed executables
- [x] Confirmed `.venv/python` precedent: `ALLOWED_PROJECT_LOCAL_INTERPRETERS` + `isAllowedProjectLocalInterpreter` (SP-638, #199)

## Step 1: Extend evidence allowlist

**Status:** In Progress

**Plan (Review Level 1):**
1. Add `cargo`, `task` to `ALLOWED_EVIDENCE_EXECUTABLES`.
2. Add bounded `PATH="…"` segment prefix: entries limited to `$PATH`, `$HOME/<safe-relative>`, or project-relative safe paths (no `$`, no `..`, not absolute, charset `[A-Za-z0-9._/-]`). Strip validated prefix per `&&` segment before metachar/`$` scans in `assertSafeEvidenceCommand` and before tokenizing in `parseEvidenceSegmentArgv`; any remaining `$` still rejects (fail-closed).
3. `runEvidenceCommand` applies prefix entries to `env.PATH` for `execFileSync` (no shell; `$HOME`→`os.homedir()`, `$PATH`→`process.env.PATH`).
4. New tests in `tests/batch/evidence-cargo-task.test.mjs`.

**Done:**
- [x] `cargo` and `task` added to `ALLOWED_EVIDENCE_EXECUTABLES`
- [x] Bounded `PATH="…"` prefix parsed per `&&` segment (`isAllowedEvidencePathEntry`); `$(…)`, `${…}`, arbitrary `$VAR`, absolute and `..` entries still rejected fail-closed
- [x] Tests: cargo/task allowlist, PATH-prefixed cargo (`$HOME/.cargo/bin:$PATH`, project-relative), per-segment chain prefixes, rejection cases, exec-env application — 17 new tests green

## Step 2: Preflight advisory

**Status:** Complete

- [x] `src/doctor/evidence-config-warn.mjs` — `buildEvidenceConfigWarnDoctorChecks` validates `testing.build` / `testing.test` / `testing.testWithCoverage` / `testing.review` via `parseEvidenceCommandChain` and emits `ok: true, warning: true` advisories
- [x] Wired into `run-doctor-checks.mjs` (non-blocking; preflight reuses `runDoctorChecks`)

## Step 3: Testing & Verification

**Status:** Complete

- [x] `npm run typecheck` — clean
- [x] Contract tests: 45 pass / 0 fail (`evidence-cargo-task.test.mjs`, `evidence.test.mjs`), exit 0
- [x] Adjacent suites (`evidence-allowlisted-chains`, `evidence-gate-resilience`, `spine-config-testing`, `issue-draft`): 29 pass / 0 fail
- [x] Docs: `docs/adoption/operator-runbook.md` evidence-allowlist table + #254 row updated

## Step 4: Documentation & Delivery

**Status:** Complete

- [x] `.DONE` created; completion criteria met: cargo/task accepted, bounded PATH prefix works with arbitrary `$` still rejected, doctor/preflight advisory non-blocking, closes #254

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| | | | |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| | | |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-19 | Task staged | PROMPT.md and STATUS.md created for v2.14.1 release |
| 2026-08-20 | Step 0-2 complete | Allowlist + PATH prefix + doctor advisory implemented; contract tests green |
| 2026-08-20 | Review note | spine_review_step (plan) skipped — real-pi session; engine runs reviews after .DONE |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
