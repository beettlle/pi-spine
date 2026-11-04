# SP-849: `spine doctor` warns when stet is older than v1.4.0 — Status

**Current Step:** .DONE
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-04
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `buildStetCapacityDoctorCheck` and the doctor check list; report the blast radius in STATUS

**Blast radius (GitNexus upstream, depth 3, risk HIGH — additive change, no behavior edits to the capacity check):**
- d=1 direct caller: `runDoctorChecks` (src/doctor/run-doctor-checks.mjs:542 push site); also called from tests/doctor/stet-capacity.test.mjs
- d=2: `checkDoctor` (src/config/spine-preflight-lib.mjs), `buildIssueDraftBody` (src/cli/issue-draft.mjs)
- d=3: `runBatchPreflight` (src/config/spine-preflight-lib.mjs) → batch start paths
- 4 affected processes (doctor CLI + batch preflight). HIGH rating comes from preflight reachability — mitigated by the new check being a separate export that never sets `ok: false`, and the existing capacity check untouched.

### Step 1: Version check
**Status:** ✅ Complete

- [x] Parse `vX.Y.Z` from `stet --version`; numeric compare against 1.4.0
- [x] Skip / ok / warning results as specified; never `ok: false`
- [x] Wired into `run-doctor-checks.mjs`

**Artifacts:**
- `src/doctor/stet-capacity.mjs` (+44, within ≤ +45), `src/doctor/run-doctor-checks.mjs` (net +2, within ≤ +3) (modified)

### Step 2: Tests
**Status:** ✅ Complete

- [x] Missing, 1.3.0, 1.4.0, 1.10.0, garbage

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [x] Fix all failures

All green in the foreground: `eslint --max-warnings 0` clean, both tsc projects clean, contract suite 21/21 pass. One typecheck failure (`atLeast` implicit-any params under checkJs) was fixed mid-step.

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Runbook §8.1 prerequisites mention the doctor check
- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-849-doctor-stet-version-floor/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| 0 | Plan | 0 | APPROVE | .reviews/0-20261104T004534.md |

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `skills/spine-release-operator/SKILL.md` already documents the advisory `ok:true, warning:true` doctor pattern (line 76); new stet version check follows the same contract — no edit needed | Checked, not affected | skills/spine-release-operator/SKILL.md |
| tsc checkJs requires explicit JSDoc types on helper params; `StetSemVer` typedef added, net file budget exactly +45 | Noted | src/doctor/stet-capacity.mjs |
| `phase23-exit-verify` asserts `checks.length >= 5`; new check appends (does not reorder) so assertion holds | Noted | tests/cli/phase23-exit-verify.test.mjs |
| `npm run coverage:check` fails with 61 batch e2e failures when the worker's inherited `SPINE_IS_WORKER=1` reaches child processes (`nested_batch_spawn_blocked`); re-run with `env -u SPINE_IS_WORKER` → 3198/3198 pass, 91.28% line coverage (≥ 77%). Matches PROMPT Environment note | Noted | /tmp logs; .spine env contract |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |
| 2026-11-03 | Steps 0–4 complete; contract testCommand green (lint + typecheck + 21 tests) | Implementation + tests + runbook committed |
| 2026-11-04 | Engine plan review returned APPROVE (non-blocking suggestion only); prior session exited before persisting .DONE | Resume: re-ran contract testCommand in foreground — lint clean, both tsc projects clean, 21/21 pass (skip / v1.4.0+v1.10.0 numeric / v1.3.0 warn / unparseable warn); full-suite coverage result on identical HEAD stands (91.28% ≥ 77%); recreated .DONE |

## Blockers

*None*
