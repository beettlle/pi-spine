# Task: SP-196 — Worker prompt review delegation

**Created:** 2026-06-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Prevention — worker prompt must not instruct pi to spawn code/final reviews after `.DONE`.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Update worker tail prompt and agent template so real-pi workers:
1. Run **plan review only** at step checkpoints when RL≥1 (via `spine_review_step` stub or engine).
2. Do **not** invoke code or final review from inside the worker — engine runs those (SP-195 / SP-151).
3. **Exit immediately** after creating `.DONE` — no further tool calls or reviewer spawns.

**Incident:** SP-190 worker attempted post-completion `spine review step` after `.DONE`.

## Dependencies

- **Task:** SP-195

## Context to Read First

**Tier 3:**
- `src/batch/worker-prompt.mjs` — `buildReviewLevelHint`, `buildDoneCheckpointHint`
- `.spine/agents/worker.md` (template)
- `tests/batch/worker-prompt.test.mjs`, `tests/agents/template-drift.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/worker-prompt.mjs`
- `templates/agents/worker.md` (if present)
- `tests/batch/worker-prompt.test.mjs`
- `tests/agents/template-drift.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | see File Scope |
| fileScopeMustNotChange | — |
| minLineCoverage | 77 |
| artifactsMustExist | — |

## Steps

### Step 0: Preflight

- [ ] Read current `buildReviewLevelHint` text
- [ ] Align with SP-194 guard + SP-195 engine ownership

### Step 1: Update prompts

- [ ] RL1: plan review at step boundaries only
- [ ] RL2+: code review delegated to engine; worker stops at `.DONE`
- [ ] Explicit: "Do not call spine_review_step with type code or final"

### Step 2: Testing & Verification

- [ ] Template drift tests updated
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Worker prompt/agent text matches engine-owned code/final review model
- [ ] Tests assert absence of "spawn code review after done" guidance

## Git Commit Convention

- `feat(SP-196): complete Step N — description`

## Do NOT

- Change reviewer agent template (separate concern)
