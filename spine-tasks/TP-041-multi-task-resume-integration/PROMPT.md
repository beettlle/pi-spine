# Task: TP-041 — Multi-task resume integration + docs

**Created:** 2026-06-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-041-multi-task-resume-integration/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Add **end-to-end integration coverage** and operator docs for multi-task resume (closes regression from batch `20260602T181027`).

Deliverables:
1. **`tests/batch/resume-multi-integration.test.mjs`** — build 2-task batch fixture (start → pause/interrupt → resume); assert both tasks reach expected state under stub workers
2. **Diagnosis UX** — `spine status --diagnose` mentions multi-task resume when batch paused with >1 pending task (reuse reconciliation message)
3. **Docs** — README batch recovery section; CONTEXT Phase 8 table; update execution policy note (#2 one-task-per-batch → optional multi-task resume)
4. **Gap list** — remove multi-task resume deferral

**Success:** integration test passes; docs accurate; full suite green.

## Dependencies

- **TP-040** — multi-task resume engine

## Context to Read First

**Tier 3:** `tests/batch/resume-multi-engine.test.mjs`, `docs/compatibility/phase6-dogfood-report.md`, README batch section

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `tests/batch/resume-multi-integration.test.mjs` (new)
- `src/batch/status-diagnosis.mjs` or equivalent (if message tweak needed)
- `README.md`, `taskplane-tasks/CONTEXT.md`, `docs/compatibility/taskplane-gap-list.md`

## Steps

### Step 0: Preflight

- [ ] Confirm TP-040 engine tests pass; baseline full suite

### Step 1: Integration test

> **Plan-review checkpoint**

- [ ] Fixture: 2 dependent or independent tasks, pause mid-batch, resume, assert completion path
- [ ] Use temp dir + stub workers only

**Artifacts:** `tests/batch/resume-multi-integration.test.mjs`

### Step 2: Docs + diagnosis

- [ ] Update README recovery steps for multi-task batches
- [ ] CONTEXT Phase 8 + execution policy
- [ ] Diagnosis string when multi-task paused

### Step 3: Verification

- [ ] Full suite green

## Completion Criteria

- [ ] Integration test passes
- [ ] Docs updated
- [ ] Full suite green

## Must Update

- `README.md`
- `taskplane-tasks/CONTEXT.md`
- `docs/compatibility/taskplane-gap-list.md`

## Check If Affected

- `docs/PRD.md` — only if behavior diverges from spec
- `bin/spine.mjs` help text

## Do NOT

- Do not change resume engine logic except diagnosis strings
- Do not publish npm package

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-031): spine deps CLI`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
