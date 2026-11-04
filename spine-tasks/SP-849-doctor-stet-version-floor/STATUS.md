# SP-849: `spine doctor` warns when stet is older than v1.4.0 — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-03
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
**Status:** ⬜ Not Started

- [ ] Parse `vX.Y.Z` from `stet --version`; numeric compare against 1.4.0
- [ ] Skip / ok / warning results as specified; never `ok: false`
- [ ] Wired into `run-doctor-checks.mjs`

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Missing, 1.3.0, 1.4.0, 1.10.0, garbage

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook §8.1 prerequisites mention the doctor check
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-849-doctor-stet-version-floor/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |

## Blockers

*None*
