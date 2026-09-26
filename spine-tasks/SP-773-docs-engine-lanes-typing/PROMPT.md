# Task: SP-773 — Document engine-lanes typing (#266 Phase 2 / #283)

**Created:** 2026-09-26
**Size:** S

## Review Level: 0 (None)

**Risk:** Documentation only; no runtime code.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** After SP-770–772, operators need a short note that engine-lanes is typed under `tsconfig.batch.json` and #266 Phase 2 / #283 is done; Phase 3 (#284) remains deferred.

## Mission

Document that `src/batch/engine-lanes/**` (and the facade) are included in batch typecheck without `@ts-nocheck`, and that #266 Phase 3 (reconcile/doctor — #284) remains open. Do not change product code (SP-770–772 own typing).

## Dependencies

- **Task:** SP-772 (#283 typing complete on `main`)

## Context to Read First

- GitHub #283 / #284
- `tsconfig.batch.json` — include list after SP-772
- `docs/QUICK-REFERENCE.md`
- `spine-tasks/SP-757-minpi-engines-docs/PROMPT.md` — docs-only packet pattern

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/QUICK-REFERENCE.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-772 `.DONE` and no `@ts-nocheck` under engine-lanes
- [ ] Dependencies satisfied

### Step 1: Document Phase 2 typing status

- [ ] Note engine-lanes typed via `tsconfig.batch.json` / arch allowlist shrink
- [ ] Explicitly defer #284 (reconcile/doctor) as Phase 3 follow-up

**Artifacts:**
- `docs/QUICK-REFERENCE.md` (modified)
- `docs/adoption/operator-runbook.md` (modified)

### Step 2: Testing & Verification

- [ ] Run Contract `testCommand` (`true`)
- [ ] Confirm File Scope paths changed

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/QUICK-REFERENCE.md` — batch typing / engine-lanes note
- `docs/adoption/operator-runbook.md` — short #266 Phase 2 done / Phase 3 deferred note

**Check If Affected:**

- None

## Completion Criteria

- [ ] Docs state engine-lanes typing complete; #284 deferred
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-773): document engine-lanes typing (#283 Phase 2)`

## Amendments

- 2026-09-26: SP-769 already changed `docs/QUICK-REFERENCE.md` on `main`. It stays in File Scope and Must Update, but `fileScopeMustChange` now lists only `docs/adoption/operator-runbook.md` (prelanded-file-scope preflight warning).

## Do NOT

- Edit `src/batch/engine-lanes/**` or allowlist
- Close #284
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
