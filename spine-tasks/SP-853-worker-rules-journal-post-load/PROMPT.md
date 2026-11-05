# Task: SP-853 — `worker.rules_selected` reports what actually loaded

**Created:** 2026-11-01
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Journal-only change; consumers (#208 cost metrics, operators) read this event. A shape change must stay additive.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** `buildWorkerContextAsync` (`src/config/worker-context.mjs` ~306) emits `worker.rules_selected` before `loadContextDocEntries` applies the byte cap (~340). Its `capped` is `selection.capped` (the `maxRules` cap), and there is no `bytesUsed`, `byteCap`, `truncated`, or skipped list. `buildReviewerContext` (`src/config/reviewer-context.mjs` ~49, ~236) emits after loading with `bytesUsed` / `byteCap`. Batch `20261010T033529-cc95` logged `pathCount: 6, capped: false` while only 3 rules loaded. SP-852 (dependency) makes the loader skip-and-continue and fills `skipped` with `{ path, reason, sizeBytes }`.

## Mission

Closes #345 — `worker.rules_selected` matches the reviewer event's post-load shape:

1. Emit `worker.rules_selected` after `loadContextDocEntries`, keeping existing fields (`paths`, `pathCount`, `capped` from selection) and adding `bytesUsed`, `byteCap`, `truncated`, and `skipped` (`[{ path, reason }]`).
2. Test: a selection over the byte cap journals `truncated: true`, the skipped path with reason `byte_cap`, and `bytesUsed ≤ byteCap`.

## Dependencies

- **Task:** SP-852 (loader returns `skipped` entries with reasons)

## Context to Read First

- GitHub #345
- `src/config/worker-context.mjs` 280-404
- `src/config/reviewer-context.mjs` 40-60, 225-244 (target shape)
- `tests/config/worker-context.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio + OpenJev for the stet `reviewCommand` only
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/config/worker-context.mjs` — ≤ 430 lines after SP-852; net change ≤ +15
- `tests/config/worker-context.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/config/worker-context.test.mjs tests/batch/worker-prompt-rules.test.mjs tests/batch/resume-orphan-recovery.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh lenient SP-853` |
| fileScopeMustChange | `src/config/worker-context.mjs`, `tests/config/worker-context.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `buildWorkerContextAsync`; report the blast radius in STATUS
- [ ] `rg -n "worker.rules_selected" src tests` — list consumers; confirm the change is additive for each

### Step 1: Post-load journal

- [ ] Event emitted after loading with `bytesUsed`, `byteCap`, `truncated`, `skipped`

**Artifacts:**
- `src/config/worker-context.mjs` (modified)

### Step 2: Tests

- [ ] Over-cap selection journals truncation and the skipped path

**Artifacts:**
- `tests/config/worker-context.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-853-worker-rules-journal-post-load/.DONE`

**Stet review (Contract `reviewCommand`, blocking):** fix real defects in this task's diff. For a stet false positive, `stet dismiss <id> <reason>` citing lint/typecheck/test evidence, record it under Discoveries, and file it at https://github.com/beettlle/stet/issues. Never edit `.review/` or remove the `reviewCommand`.

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` journal event list (note in Discoveries; do not edit)

## Completion Criteria

- [x] `worker.rules_selected` reports bytes used, cap, truncation, and skipped paths

## Git Commit Convention

- `fix(SP-853): journal worker.rules_selected after loading with byte-cap fields`

## Do NOT

- Remove or rename existing event fields
- Change the loader (SP-852) beyond reading its result
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
