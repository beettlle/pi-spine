# Task: SP-849 — `spine doctor` warns when stet is older than v1.4.0

**Created:** 2026-11-01
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Advisory doctor check. A wrong parse could warn on every run; it must never fail preflight.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** Since SP-846, `scripts/spine-stet-contract-run.sh` gates on `stet list --min-severity/--min-confidence`, which exist only in stet ≥ v1.4.0. Older stet falls back to gating on every active finding (one stderr line per contract run), which reproduces the v2.29.0 false-positive stalls. `src/doctor/stet-capacity.mjs` (171 lines) already probes stet with `tryExec("stet", ["--version"])` (`stetOnPath`, ~109) and builds the advisory `stet review capacity` check (~120-171); it is wired in `src/doctor/run-doctor-checks.mjs` (~27). `stet --version` prints `stet version v1.4.0`.

## Mission

`spine doctor` reports the installed stet version and warns when it is below v1.4.0:

1. New exported check builder (`buildStetVersionDoctorCheck`) in `src/doctor/stet-capacity.mjs` with an injectable `stetVersion` probe returning the raw `stet --version` output or `null`.
2. Results: stet not on PATH → `ok: true`, `detail: "stet not on PATH (skipped)"`; version ≥ 1.4.0 → `ok: true`, detail `stet vX.Y.Z`; older or unparseable → `ok: true, warning: true`, detail naming the version and that the contract gate falls back to every active finding, `suggestedCommand: "curl -fsSL https://raw.githubusercontent.com/beettlle/stet/main/install.sh | bash"`.
3. Wire it into `run-doctor-checks.mjs` next to the capacity check. It never sets `ok: false`.
4. Tests: missing, 1.3.0, 1.4.0, 1.10.0 (numeric compare, not string), garbage output.

## Dependencies

- **Task:** SP-847 (rewrites runbook §8.1; this task adds the doctor check to its prerequisites)

## Context to Read First

- `src/doctor/stet-capacity.mjs` (whole file)
- `src/doctor/run-doctor-checks.mjs` 1-40 and where `buildStetCapacityDoctorCheck` is pushed
- `tests/doctor/stet-capacity.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio + OpenJev for the stet `reviewCommand` only
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/doctor/stet-capacity.mjs` — 171 lines; net ≤ +45
- `src/doctor/run-doctor-checks.mjs` — 655 lines (outside the `src/batch` cap); net ≤ +3
- `tests/doctor/stet-capacity.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/doctor/stet-capacity.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh lenient SP-849` |
| fileScopeMustChange | `src/doctor/stet-capacity.mjs`, `tests/doctor/stet-capacity.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `buildStetCapacityDoctorCheck` and the doctor check list; report the blast radius in STATUS

### Step 1: Version check

- [ ] Parse `vX.Y.Z` from `stet --version`; numeric compare against 1.4.0
- [ ] Skip / ok / warning results as specified; never `ok: false`
- [ ] Wired into `run-doctor-checks.mjs`

**Artifacts:**
- `src/doctor/stet-capacity.mjs`, `src/doctor/run-doctor-checks.mjs` (modified)

### Step 2: Tests

- [ ] Missing, 1.3.0, 1.4.0, 1.10.0, garbage

**Artifacts:**
- `tests/doctor/stet-capacity.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Runbook §8.1 prerequisites mention the doctor check
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-849-doctor-stet-version-floor/.DONE`

**Stet review (Contract `reviewCommand`, blocking):** fix real defects in this task's diff. For a stet false positive, `stet dismiss <id> <reason>` citing lint/typecheck/test evidence, record it under Discoveries, and file it at https://github.com/beettlle/stet/issues. Never edit `.review/` or remove the `reviewCommand`.

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — §8.1 prerequisites: doctor stet version check

**Check If Affected:**
- `skills/spine-release-operator/SKILL.md` (note in Discoveries; do not edit)

## Completion Criteria

- [ ] Doctor warns (never fails) when stet < v1.4.0

## Git Commit Convention

- `feat(SP-849): doctor warns when stet is older than v1.4.0`

## Do NOT

- Make the check fail preflight or doctor
- Run `stet` subcommands other than `--version`
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
