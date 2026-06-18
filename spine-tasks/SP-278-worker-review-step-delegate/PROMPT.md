# Task: SP-278 — Worker review-step delegate (no nested spawn noise)

**Created:** 2026-06-17
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Worker-facing UX fix across tool handler, agent prompt, and task-authoring template; touches review journal semantics.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #1**: pi workers calling `spine_review_step` for plan/code checkpoints inside pi sessions get `review.failed` / `nested_spawn_blocked` errors even though SP-195 moved engine-owned reviews off the worker.

**Outcome:** Workers at Review Level ≥ 1 should **not** treat in-worker review calls as failures. The tool returns a **successful skip** (`skipped: true`, exit 0, clear message). Task-authoring and worker standing orders tell workers to rely on the batch engine for plan/code/final review in real-pi sessions.

**Closes:** [#1](https://github.com/beettlle/pi-spine/issues/1)

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `spine-tasks/SP-195-engine-code-review-phase/PROMPT.md`
- `src/batch/review.mjs` — `isActiveWorkerSession`, `NESTED_REVIEW_SPAWN_BLOCKED`
- `extensions/spine/worker-tools.ts` — `spine_review_step` handler
- `tests/worker-tools/review-step-tool.test.mjs`
- GitHub issue #1 body (journal evidence from batch `20260617T164948`)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (stub tests)

## File Scope

- `extensions/spine/worker-tools.ts`
- `src/batch/review.mjs`
- `.spine/agents/worker.md`
- `skills/create-spine-tasks/references/prompt-template.md`
- `tests/worker-tools/review-step-tool.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | extensions/spine/worker-tools.ts, .spine/agents/worker.md, tests/worker-tools/review-step-tool.test.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read issue #1 and confirm desired behavior: skip (not error) for plan **and** code review inside `SPINE_WORKER_RUNNER` sessions
- [ ] Baseline `tests/worker-tools/review-step-tool.test.mjs` — note current nested-spawn expects `isError: true`

### Step 1: Tool + journal skip semantics

> **Plan-review checkpoint**

- [ ] When `isActiveWorkerSession()` blocks spawn, return tool result with `skipped: true`, `isError: false`, exit 0, and message directing worker to engine-owned review
- [ ] Journal `review.skipped` (or equivalent non-failure event) instead of `review.failed` for nested_spawn_blocked from worker tool path — do not pollute failure metrics
- [ ] Keep fail-closed behavior for real spawn failures outside worker sessions unchanged

### Step 2: Worker + authoring guidance

> **Code review checkpoint**

- [ ] Update `.spine/agents/worker.md`: in pi worker sessions, **do not** call `spine_review_step` for plan/code; engine runs reviews after worker success (SP-195)
- [ ] Update `skills/create-spine-tasks/references/prompt-template.md`: remove default "Call `spine_review_step` after step" for RL ≥ 1; note engine-owned review for real-pi batches
- [ ] Add operator-runbook note under nested_spawn troubleshooting pointing to this behavior

### Step 3: Testing & Verification

- [ ] Update/add tests: nested worker session → `skipped: true`, not `isError`
- [ ] Regression: stub review outside worker session still APPROVE/PASS normally
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77% line coverage

### Step 4: Documentation & Delivery

- [ ] Record discoveries in STATUS.md
- [ ] Close GitHub issue #1: `gh issue close 1 --comment "Fixed in SP-278: spine_review_step returns skipped (exit 0) inside worker sessions; worker.md and prompt template delegate plan/code review to engine."`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — nested_spawn / worker review delegation

**Check If Affected:**
- `README.md` — worker tools table if behavior description changed

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #1 closed with comment referencing SP-278
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-278): complete Step N — description`
- `fix(SP-278): description`
- `test(SP-278): description`

## Do NOT

- Re-enable nested pi reviewer spawn inside worker sessions
- Change engine-owned review phases in `engine-lanes/review.mjs` (SP-279 scope)
- Mass-edit historical completed task PROMPTs under `spine-tasks/`

---

## Amendments (Added During Execution)
