# Task: SP-368 — Deferred observability stream explore

**Created:** 2026-06-29
**Size:** L

## Review Level: 0 (None)

**Assessment:** Explore-only design doc for deferred FR-SHIP-11 stretch; no implementation.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Address **GitHub issue #52**: produce explore documentation for deferred live agent/worker observability stream (structured pi events into journal or SSE).

**Required behavior:**

1. Write `spine-tasks/_explore/operator-observability-stream/findings.md` with design options and tradeoffs
2. Link from operator runbook as deferred capability
3. Close #52 with explore deliverable (no runtime code)

**Closes:** [#52](https://github.com/beettlle/pi-spine/issues/52)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #52
- Epic #43
- `docs/PRD-v2.2-ship-readiness-handoff.md` FR-SHIP-11
- `docs/PRD.md` §16.3 dashboard non-goals

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/_explore/operator-observability-stream/findings.md`
- `docs/adoption/operator-runbook.md`
- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| artifactsMustExist | `spine-tasks/_explore/operator-observability-stream/findings.md` |

## Steps

### Step 0: Preflight

- [ ] Read FR-SHIP-11 defer rationale and Tier 1/2 deliverables (#44–#51)

### Step 1: Write explore findings

- [ ] Document options: journal stream vs per-lane SSE vs supervisor agent
- [ ] Security, volume, redaction, NFR-OBS-04 constraints
- [ ] Recommended phasing after SP-360–367

### Step 2: Runbook deferred pointer

- [ ] Short deferred-capability note in operator runbook linking explore doc

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Update CONTEXT.md explore table
- [ ] Close issue #52 (`gh issue close 52`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Explore findings published
- [ ] Issue #52 closed
- [ ] No application code changes beyond docs

## Git Commit Convention

- `feat(SP-368): complete Step N — description`

## Do NOT

- Implement streaming infrastructure in this task
- Scope creep into supervisor agent implementation
