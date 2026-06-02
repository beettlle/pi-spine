# Task: TP-038 — spine_request_gate tool + worker wiring

**Created:** 2026-06-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 1, Reversibility: 0

## Canonical Task Folder

```
taskplane-tasks/TP-038-worker-gate-and-registration/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Complete worker MCP tool surface (PRD §14.5): **`spine_report_progress`** Pi tool, **`spine_request_gate`**, worker template updates, and lane worker tool activation.

Deliverables:
1. **`spine_report_progress` tool** — wraps TP-036 `reportTaskProgress`; params `{ step, checkboxesComplete, checkboxesTotal }`
2. **`spine_request_gate` tool** — minimal v1.1: open/refresh `manual` gate via existing gate APIs OR return structured `not_supported` with `suggestedCommand: spine gate` when integrate-only; document limitation
3. **`registerSpineWorkerTools`** exports all three tools; orchestrator registers on load
4. **Worker templates** — `.spine/agents/worker.md` + `templates/agents/worker.md`: list spine tools; prefer tools over bash for review/progress
5. **`bin/spine-worker-runner.mjs`** — document/export env vars workers need; optional `--tools` hint in worker prompt
6. **Tests** — progress tool handler; gate tool returns expected shape; registration count === 3

**Success:** all three PRD tools registered; worker.md documents them; tests green.

## Dependencies

- **TP-037** — worker-tools registrar exists
- **TP-036** — report progress tool core

## Context to Read First

**Tier 3:**
- `extensions/spine/worker-tools.ts`, `src/worker-tools/report-progress.mjs`
- `src/batch/gate.mjs` or gate CLI used by `/spine-gate`
- `bin/spine-worker-runner.mjs`, `templates/agents/worker.md`

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `extensions/spine/worker-tools.ts` (extend)
- `src/worker-tools/request-gate.mjs` (new — thin wrapper)
- `templates/agents/worker.md`, `.spine/agents/worker.md`
- `bin/spine-worker-runner.mjs`
- `tests/worker-tools/worker-tools-registration.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Read gate FSM for manual gate open path; inventory env vars set by worker runner
- [ ] Baseline tests

### Step 1: Progress + gate tool handlers

> **Plan-review checkpoint**

- [ ] Add `spine_report_progress` tool delegating to core module
- [ ] Add `spine_request_gate` with bounded behavior + clear errors
- [ ] Pure module `src/worker-tools/request-gate.mjs` testable without pi host

**Artifacts:** `extensions/spine/worker-tools.ts`, `src/worker-tools/request-gate.mjs`

### Step 2: Worker wiring + templates

> **Code review checkpoint**

- [ ] Update worker agent templates with tool names and usage notes
- [ ] Ensure worker runner exports `SPINE_BATCH_ID`, `SPINE_TASK_ID`, `SPINE_LANE_ID`, `SPINE_TASK_FOLDER`
- [ ] Registration integration test (mock pi)

### Step 3: Verification

- [ ] Full suite + typecheck
- [ ] Update gap list / dogfood deferral note for worker MCP tools

## Completion Criteria

- [ ] Three tools registered per PRD §14.5
- [ ] Worker templates updated
- [ ] Tests pass

## Must Update

- `docs/compatibility/taskplane-gap-list.md`
- `templates/agents/worker.md`

## Check If Affected

- `docs/PRD.md` — only if behavior diverges from spec
- `bin/spine.mjs` help text

## Do NOT

- Do not implement pi-subagents backend
- Do not auto-approve integrate gates from worker tool

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-031): spine deps CLI`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
