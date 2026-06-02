# Task: TP-037 — spine_review_step Pi tool

**Created:** 2026-06-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** 4/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-037-worker-review-step-tool/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Register **`spine_review_step`** as a Pi extension tool (PRD §14.5) wrapping existing review CLI logic so workers can call it without shelling out.

Deliverables:
1. **`extensions/spine/worker-tools.ts`** — `registerSpineWorkerTools(pi)` scaffold; implement `spine_review_step` via `pi.registerTool` + `defineTool` pattern
2. **Tool params:** `{ step: number, type?: 'plan'|'code', baseline?: string }` — delegate to `runSpineReviewStep` from `bin/spine-review-step.mjs` (extract shared import path if needed)
3. **Fail closed** when `SPINE_TASK_FOLDER` / batch context missing — structured tool error
4. **Tests** — mock `registerTool`; param validation; stub review path (`--stub`)

**Success:** extension registers tool name `spine_review_step`; test asserts schema + handler exit codes.

## Dependencies

- **TP-036** — worker-tools module layout established
- **TP-020** — `runSpineReviewStep` CLI exists

## Context to Read First

**Tier 3:**
- `bin/spine-review-step.mjs`, `src/batch/review.mjs`
- `node_modules/@earendil-works/pi-coding-agent` — `registerTool`, `defineTool`
- `extensions/spine-orchestrator.ts`

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `extensions/spine/worker-tools.ts` (new)
- `extensions/spine-orchestrator.ts` — call registrar
- `tests/worker-tools/review-step-tool.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Read `ExtensionAPI.registerTool` + an upstream `defineTool` example from pi-coding-agent docs/types
- [ ] Baseline tests + typecheck

### Step 1: Review step tool

> **Plan-review checkpoint**

- [ ] Create tool definition with JSON schema for params
- [ ] Handler invokes `runSpineReviewStep`; return verdict JSON to model
- [ ] Wire `registerSpineWorkerTools` from orchestrator entry

**Artifacts:** `extensions/spine/worker-tools.ts`, `extensions/spine-orchestrator.ts`

### Step 2: Tests

> **Code review checkpoint**

- [ ] Static/handler tests with stub review
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Completion Criteria

- [ ] Tool registered with correct name and params
- [ ] Fail-closed without batch context
- [ ] Typecheck + tests pass

## Must Update

- `extensions/spine-orchestrator.ts`

## Check If Affected

- `docs/PRD.md` — only if behavior diverges from spec
- `bin/spine.mjs` help text

## Do NOT

- Do not implement progress/gate tools in this task (TP-038)
- Do not change review verdict logic

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-031): spine deps CLI`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
