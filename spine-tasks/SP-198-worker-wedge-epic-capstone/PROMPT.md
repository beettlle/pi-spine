# Task: SP-198 — Worker wedge epic capstone (CONTEXT + findings)

**Created:** 2026-06-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Close SP-193–197 tracking; verify SP-190 batch retry succeeds end-to-end.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Capstone for the **worker wedge** reliability mini-epic (SP-193–197):

1. Update `spine-tasks/CONTEXT.md` — Phase 22 table + new epic table for worker wedge tasks.
2. Update `spine-tasks/dependencies.json` if needed.
3. Finalize `spine-tasks/_explore/reliability-epic/findings.md` — SP-190 incident closed.
4. Verify: `node bin/spine.mjs batch retry SP-190` (or fresh RL2 stub batch) completes without wedge.
5. Mark exit criterion: operator runbook includes post-done wedge recovery.

## Dependencies

- **Task:** SP-193
- **Task:** SP-194
- **Task:** SP-195
- **Task:** SP-196
- **Task:** SP-197

## Context to Read First

**Tier 3:**
- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`
- `spine-tasks/_explore/reliability-epic/findings.md`
- Batch `20260611T222221` status

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (stub); optional SP-190 retry on live batch

## Testing

Verification via full stub test suite and `spine plan pending` / optional `spine batch retry SP-190` after wedge fixes land.

## File Scope

- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`
- `spine-tasks/_explore/reliability-epic/findings.md`
- `docs/adoption/operator-runbook.md` (if SP-197 did not land runbook §)

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

- [ ] Confirm SP-193–197 all `.DONE`
- [ ] `spine plan pending` shows no wedge epic tasks

### Step 1: CONTEXT + findings

- [ ] Phase 22 / new section documents SP-193–198
- [ ] Findings: SP-190 wedge → resolved by SP-193–197

### Step 2: Verification

- [ ] Full test suite green
- [ ] Optional: SP-190 retry or stub RL2 batch completes

### Step 3: Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] All wedge epic tasks Done in CONTEXT
- [ ] Operator can recover hung-after-.DONE without manual pi kill

## Git Commit Convention

- `feat(SP-198): complete Step N — description`

## Do NOT

- Reopen SP-191 scope unless merging tables
