# Task: SP-568 — done-marker fail-closed explore

**Created:** 2026-07-09
**Size:** S

## Review Level: 0 (None)

**Assessment:** Read-only explore for #190 before engine changes.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Write explore findings at [`spine-tasks/_explore/done-marker-fail-closed/findings.md`](../_explore/done-marker-fail-closed/findings.md) documenting code paths that promote without committed `.DONE`. Record operator decision: **fail-closed** (block promote/merge when lane branch lacks committed `.DONE`).

**Partial:** [#190](https://github.com/beettlle/pi-spine/issues/190) (explore only; implementation SP-569)

## Dependencies

- **Task:** SP-566

## Context to Read First

- [`spine-tasks/_explore/done-marker-fail-closed/findings.md`](../_explore/done-marker-fail-closed/findings.md) — update if pre-staged
- [`src/batch/journal-rebuild.mjs`](../../src/batch/journal-rebuild.mjs) — `reconcileBatchStateDrift`, `journalShowsDoneInLaneTerminalArtifacts`
- [`src/batch/attached-runner.mjs`](../../src/batch/attached-runner.mjs) — attached promote path
- Issue [#190](https://github.com/beettlle/pi-spine/issues/190) consumer reproduction

## File Scope

- `spine-tasks/_explore/done-marker-fail-closed/findings.md`
- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `spine-tasks/_explore/done-marker-fail-closed/findings.md` |

## Steps

### Step 0: Preflight

- [ ] Read issue #190 and SP-512 reconcile tests
- [ ] Trace `skippedDoneOnDisk` journal payloads

### Step 1: Write findings

- [ ] Complete explore template: Summary, Codebase areas, Risks, Suggested file scopes
- [ ] Document fail-closed decision in Summary
- [ ] Link explore row in CONTEXT.md

**Artifacts:**
- `spine-tasks/_explore/done-marker-fail-closed/findings.md`

### Step 2: Testing & Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Findings complete; SP-569 file scope unblocked

## Git Commit Convention

- `docs(SP-568): explore done-marker fail-closed paths (#190)`

## Do NOT

- Modify `src/**` (explore is read-only)
- Implement fail-closed logic (SP-569)
