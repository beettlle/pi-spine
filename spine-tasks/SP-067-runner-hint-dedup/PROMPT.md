# Task: SP-067 — Runner hint deduplication

**Created:** 2026-06-03
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Refactors duplicated inline worker hints from two runners into a shared module (or minimal runner that defers to worker.md) — touches batch code and optional tests.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Deduplicate inline worker instructions duplicated in `bin/spine-worker-runner.mjs` and `src/batch/agent-session-worker.mjs` versus the canonical `templates/agents/worker.md`. Prefer extracting shared prompt tail text to `src/batch/worker-prompt.mjs` (new) that both runners import, **or** slim runners to reference worker.md only for standing orders. After SP-064, commit-hint wording must match the aligned convention without re-duplicating full checkpoint discipline in runner strings.

## Dependencies

- **Task:** SP-064 (commit convention must be finalized first)

## Context to Read First

**Tier 3:**
- `bin/spine-worker-runner.mjs` — `piArgs` tail prompt
- `src/batch/agent-session-worker.mjs` — `buildAgentSessionWorkerPrompt`
- `templates/agents/worker.md` — canonical standing orders (post SP-062/063/064)
- `tests/batch/` — existing agent-session tests for patterns

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-worker-runner.mjs`
- `src/batch/agent-session-worker.mjs`
- `src/batch/worker-prompt.mjs` (new, preferred)
- `tests/batch/worker-prompt.test.mjs` (new, optional)

## Steps

### Step 0: Preflight

- [ ] Diff inline hints in both runners; list duplicated vs worker.md-only content
- [ ] Read SP-064 chosen commit format

### Step 1: Design shared prompt module

> **Plan-review checkpoint**

- [ ] Choose approach: (A) `worker-prompt.mjs` exports `buildWorkerTailPrompt({ taskFolder, worktreePath, donePath, reviewLevel })` or (B) minimal one-liner runner deferring to `@worker.md` + PROMPT only
- [ ] Document what stays in runner (paths, `@PROMPT.md`, `@.spine/agents/worker.md` append) vs shared module

**Artifacts:**
- Design note in STATUS Discoveries

### Step 2: Implement deduplication

> **Code review checkpoint**

- [ ] Create `src/batch/worker-prompt.mjs` (if approach A) with single source for tools hint, review hint, commit hint, `.DONE` guidance
- [ ] Update `bin/spine-worker-runner.mjs` to use shared builder
- [ ] Update `src/batch/agent-session-worker.mjs` `buildAgentSessionWorkerPrompt` to use shared builder
- [ ] Remove duplicated paragraphs that now live only in `templates/agents/worker.md`

**Artifacts:**
- `src/batch/worker-prompt.mjs` (new)
- Both runners (modified)

### Step 3: Tests + verification

- [ ] Add `tests/batch/worker-prompt.test.mjs` covering commit hint format, review level > 0 hint, done path reference (optional but preferred)
- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Grep: no stale duplicate long-form checkpoint text in runners

## Documentation Requirements

**Must Update:**
- None required (behavior unchanged; DRY refactor)

**Check If Affected:**
- `docs/PRD.md` — only if runner behavior docs exist elsewhere

## Completion Criteria

- [ ] Runners share one implementation for inline tail hints (or minimal defer-to-worker.md)
- [ ] Commit hint matches SP-064 convention
- [ ] Tests pass including new worker-prompt tests (if added)

## Git Commit Convention

- **Step completion:** `feat(SP-067): complete Step N — description`
- **Refactor:** `refactor(SP-067): extract worker-prompt module`

## Do NOT

- Change worker.md standing orders (SP-062/063)
- Re-open commit format debate (SP-064 locked)
- Add template drift tests (SP-069)

## Amendments

_(Workers only.)_
