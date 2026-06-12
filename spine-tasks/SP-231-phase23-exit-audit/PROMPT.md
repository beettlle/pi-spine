# Task: SP-231 — Phase 23 exit audit helper

**Created:** 2026-06-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Exit gate honesty — SP-214 requires §8 checklist execution; stress test showed criteria failing while operator nearly integrated stub `.DONE`.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Ship an **operator-runnable Phase 23 exit audit** that SP-214 (and supervisors) can invoke to prove §8 criteria before `.DONE`:

1. Add CLI (e.g. `node bin/spine.mjs verify phase23-exit` or `spine doctor --phase23-exit`) that checks PRD §8 Phase 23 bullets:
   - `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (optional `--skip-test` for doc-only pass)
   - `src/batch/*.mjs` line counts vs 500 LOC policy **with explicit grandfather/exemption list** reconciled to FR-SHIP-02 (`engine-lanes` split done; document remaining >500 files or update PRD §8 wording — pick one policy, document in PRD + CONTEXT)
   - Real-pi workflow presence + skip-when-absent docs (SP-212)
   - CONTEXT Phase 23 task statuses reflect landed work (SP-205–213 Done, SP-214 pending until audit green)
   - `docs/adoption/real-project-readiness.md` test counts (or note file missing / path change)
2. Exit non-zero with structured checklist output when any criterion fails (for CI/supervisor gate).
3. Update SP-214 PROMPT Step 1 to call this helper; do **not** mark SP-214 Done here.

**Incidents (SP-205–225 stress test):**
- Manual audit at Wave 6 block: five `src/batch/*.mjs` files still >500 LOC while `engine-lanes.mjs` is 363 LOC; CONTEXT still lists SP-205–214 as **Staged** on `main`.
- Batch `20260612T204048` gate rejected — stub `.DONE` only.

## Dependencies

- **Task:** SP-213
- **Task:** SP-211
- **Task:** SP-212

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.2-ship-readiness-handoff.md` — §6 FR-SHIP-02, §8 Phase 23 exit
- `spine-tasks/SP-214-ship-phase23-exit/PROMPT.md`
- `spine-tasks/CONTEXT.md` — Phase 23 table (sync targets)
- `bin/spine-doctor.mjs` — existing check patterns
- `.github/workflows/real-pi.yml`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-cli/verify.mjs` (new) or extend `bin/spine-doctor.mjs`
- `bin/spine.mjs` (subcommand wiring if new CLI)
- `docs/PRD-v2.2-ship-readiness-handoff.md` (§8 wording alignment only)
- `spine-tasks/CONTEXT.md` (Phase 23 status sync for SP-205–213 Done)
- `tests/cli/phase23-exit-verify.test.mjs` (new)
- `docs/adoption/operator-runbook.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `bin/spine-cli/verify.mjs`, `tests/cli/phase23-exit-verify.test.mjs`, `spine-tasks/CONTEXT.md` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Run manual §8 audit; capture failing bullets from stress test
- [ ] Decide PRD §8 LOC policy (global `batch/*.mjs` vs engine-lanes-only vs grandfather list)

### Step 1: verify phase23-exit CLI

> **Plan-review checkpoint**

- [ ] Implement checklist runner with structured pass/fail output
- [ ] Sync CONTEXT Phase 23 statuses for landed SP-205–213

### Step 2: Testing & Verification

- [ ] Unit tests for each checklist branch (pass + representative fail fixtures)
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Runbook: SP-214 must run verify helper before `.DONE`
- [ ] PRD §8 note on LOC policy decision
- [ ] Append resolved entry to `findings.md`
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Supervisor can run one command to validate Phase 23 exit readiness
- [ ] CONTEXT reflects SP-205–213 Done on `main`
- [ ] SP-214 unblocked for honest re-run (after SP-227–230 land)
- [ ] Tests green

## Git Commit Convention

- `feat(SP-231): complete Step N — description`

## Do NOT

- Mark SP-214 Done or check §8 boxes without audit green
- Auto-integrate batches
- Expand into Phase 24+ scope

---

## Amendments (Added During Execution)
