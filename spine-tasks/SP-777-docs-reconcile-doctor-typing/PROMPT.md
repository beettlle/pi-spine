# Task: SP-777 — Document reconcile/doctor typing (#266 Phase 3 / #284)

**Created:** 2026-09-26
**Size:** S

## Review Level: 0 (None)

**Risk:** Documentation only; no runtime code.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** `docs/QUICK-REFERENCE.md` and `docs/adoption/operator-runbook.md` currently say reconcile/doctor typing is deferred to #266 Phase 3 (#284). After SP-774–776 land, those sentences are stale.

## Mission

Partial #284 (docs) — Update the batch-typing notes so they state that the reconcile cluster (`reconcile.mjs`, `reconcile-batch.mjs`, `reconcile-orphan.mjs`, `reconcile-classify.mjs`, `reconcile-diagnosis.mjs`, `reconcile-diagnosis-context.mjs`, `reconcile-light-cache.mjs`) and `src/doctor/run-doctor-checks.mjs` are type-checked via `tsconfig.batch.json` without `@ts-nocheck` (#266 Phase 3 / #284 — SP-774–SP-776). Remaining allowlisted modules stay tracked by `tests/arch/ts-nocheck-guard.test.mjs`. Do not change product code.

## Dependencies

- **Task:** SP-776 (#284 typing complete on `main`)

## Context to Read First

- GitHub #284
- `tsconfig.batch.json` — include list after SP-776
- `docs/QUICK-REFERENCE.md` — batch typing paragraph (currently ~line 805, mentions "deferred to #266 Phase 3 (#284)")
- `docs/adoption/operator-runbook.md` — `npm run typecheck` paragraph (currently ~line 2162, mentions "#266 Phase 3 (#284), deliberately deferred")
- `spine-tasks/SP-773-docs-engine-lanes-typing/PROMPT.md` — prior docs-only packet for the same paragraphs

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
| fileScopeMustChange | `docs/QUICK-REFERENCE.md`, `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-774, SP-775, SP-776 `.DONE`
- [ ] Confirm no `@ts-nocheck` in the eight #284 target files and all are in `tsconfig.batch.json` include
- [ ] Dependencies satisfied

### Step 1: Document Phase 3 typing status

- [ ] `docs/QUICK-REFERENCE.md` — replace the "reconcile/doctor remain allowlisted; deferred to #266 Phase 3 (#284)" wording with the Phase 3 done status (SP-774–SP-776)
- [ ] `docs/adoption/operator-runbook.md` — same update in the `npm run typecheck` paragraph; keep the note that other modules still carry nocheck and are tracked by the arch guard allowlist
- [ ] Keep changes to those paragraphs; no unrelated rewrites

**Artifacts:**
- `docs/QUICK-REFERENCE.md` (modified)
- `docs/adoption/operator-runbook.md` (modified)

### Step 2: Testing & Verification

- [ ] Run Contract `testCommand` (`true`)
- [ ] Run full suite with worker env unset: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`
- [ ] Confirm both File Scope paths changed (`git status`)

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/QUICK-REFERENCE.md` — batch typing note (#284 done)
- `docs/adoption/operator-runbook.md` — typecheck paragraph (#266 Phase 3 done)

**Check If Affected:**

- None

## Completion Criteria

- [ ] Docs state reconcile/doctor typing complete (#284); no stale "deferred" wording
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-777): document reconcile/doctor typing (#284 Phase 3)`

## Do NOT

- Edit `src/**`, `bin/**`, `tsconfig.batch.json`, or the arch allowlist
- Close #284 (SP-776 closes it)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
