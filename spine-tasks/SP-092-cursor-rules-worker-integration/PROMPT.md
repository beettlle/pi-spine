# Task: SP-092 — Cursor rules worker context integration

**Created:** 2026-06-04
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Connects auto-discovery to live worker prompts; depends on SP-073 static FR-WORK-05 wire and SP-091 selection.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Add `buildWorkerContextAsync()` using `selectRulesForWorker()` + PROMPT File Scope; wire into `buildWorkerTailPrompt`, worker-runner, and agent-session-worker. Emit journal `worker.rules_selected`.

## Dependencies

- **Task:** SP-091 (selection)
- **Task:** SP-073 (FR-WORK-05 static inject)

## Context to Read First

- `src/batch/worker-prompt.mjs`
- `bin/spine-worker-runner.mjs`
- `src/batch/agent-session-worker.mjs`

## File Scope

- `src/config/worker-context.mjs`
- `src/batch/worker-prompt.mjs`
- `bin/spine-worker-runner.mjs`
- `src/batch/agent-session-worker.mjs`
- `src/batch/worker-host.mjs`
- `src/batch/journal*.mjs`
- `tests/config/worker-context.test.mjs`
- `tests/batch/worker-prompt-rules.test.mjs`

## Steps

### Step 0: Preflight

- [ ] SP-091 + SP-073 satisfied
- [ ] `SPINE_WORKER_STUB=1` path identified

### Step 1: Async worker context
> **Plan-review checkpoint**

- [ ] `buildWorkerContextAsync` — manifest or discover; fallback when no `.cursor/rules/`
- [ ] `buildWorkerTailPrompt` + runner pass `taskFileScope` from packet parser
- [ ] `spine_review_step` after step

### Step 2: Journal + stub safety
> **Code review checkpoint**

- [ ] `worker.rules_selected` journal fields
- [ ] Stub path unchanged
- [ ] `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Tail includes critical-rules for JS-scoped task; append `standards` E2E
- [ ] FULL suite + coverage ≥77%

### Step 4: Documentation & Delivery

- [ ] STATUS notes for agent-session fileScope
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- None (SP-094)

**Check If Affected:**
- `templates/agents/worker.md` — one line on auto-selected standards

## Completion Criteria

- [ ] All steps complete
- [ ] Worker tail includes auto-selected rules for a JS-scoped task
- [ ] `config.standards` append verified end-to-end
- [ ] Journal emits `worker.rules_selected`
- [ ] Full test suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-092): complete Step N — description`

## Do NOT

- Implement `spine rules` CLI (SP-093)
- Dump full rules tree

---

## Amendments (Added During Execution)
