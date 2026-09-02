# Task: SP-741 — Worker prompt: foreground long verifications

**Created:** 2026-08-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Primarily worker standing-order + optional exit hint; low blast radius.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #276 — Instruct workers that long verifications (Contract `testCommand`, `release:check`, full suites) must run in the foreground and finish in-session. Do not background monitors and exit without `.DONE`. Optionally add a harness hint when exit-without-`.DONE` coincides with still-live background children.

## Dependencies

- **None**

## Context to Read First

- GitHub #276 — worker_done_missing after backgrounded verification
- `.spine/agents/worker.md` — standing orders
- `src/batch/worker-output.mjs` / diagnosis for worker_done_missing (optional hint)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `.spine/agents/worker.md`
- `src/batch/worker-output.mjs`
- `tests/batch/worker-output.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/worker-output.test.mjs` |
| fileScopeMustChange | `.spine/agents/worker.md` |

## Steps

### Step 0: Preflight

- [ ] Read worker.md verification / Monitor guidance
- [ ] Locate worker_done_missing diagnosis narration

### Step 1: Prompt guardrail

- [ ] Add explicit: long verifications must be foreground; no background-and-exit
- [ ] Clarify incompatibility of completion wakes with worker lifecycle

### Step 2: Optional harness hint + tests

- [ ] If cheap: detect live background children at exit-without-.DONE and add targeted hint
- [ ] Otherwise document-only is acceptable if prompt change is clear — note in STATUS

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] `.spine/agents/worker.md` — foreground verification rule
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `.spine/agents/worker.md` — foreground verification rule

## Completion Criteria

- [ ] worker.md forbids backgrounding long verifications
- [ ] Optional harness hint or explicit STATUS deferral with rationale
- [ ] Closes #276
- [ ] `.DONE` created

## Do NOT

- Implement full wake-continuation / session resume for workers
- Change stall or timeout classifiers (#272/#273)
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-741): worker foreground verification guardrail (#276)`
