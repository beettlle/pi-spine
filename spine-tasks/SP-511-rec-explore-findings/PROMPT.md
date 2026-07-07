# Task: SP-511 — Reconciliation v1.8.1 explore findings

**Created:** 2026-07-07
**Size:** S

## Review Level: 0 (None)

**Assessment:** Authoring-only explore artifact; no product code.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Produce `spine-tasks/_explore/reconciliation-v181/findings.md` documenting reconciliation gaps for v1.8.1 (Phase 59). Read incident journals for batches `20260705T210857` and `20260706T052912`, map to code paths in `src/batch/reconcile.mjs`, `diagnosis.mjs`, `attached-runner.mjs`, and list concrete fix targets for SP-512–519.

**Source:** [`docs/PRD-v1.8.1-reconciliation-handoff.md`](../../docs/PRD-v1.8.1-reconciliation-handoff.md)

## Dependencies

- **None**

## Context to Read First

- [`docs/PRD-v1.8.1-reconciliation-handoff.md`](../../docs/PRD-v1.8.1-reconciliation-handoff.md)
- GitHub issues [#170](https://github.com/beettlle/pi-spine/issues/170), [#184](https://github.com/beettlle/pi-spine/issues/184)
- `src/batch/reconcile.mjs`, `src/batch/diagnosis.mjs`, `src/batch/attached-runner.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/_explore/reconciliation-v181/findings.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `test -f spine-tasks/_explore/reconciliation-v181/findings.md` |
| fileScopeMustChange | `spine-tasks/_explore/reconciliation-v181/findings.md` |

## Steps

### Step 0: Preflight

- [ ] Read PRD-v1.8.1 handoff §3–§5
- [ ] Read GitHub #170 and #184 bodies

### Step 1: Explore

- [ ] Trace journal events for both incident batches
- [ ] Document root causes and proposed SP-512–519 mapping
- [ ] Write findings.md with code anchors and test recommendations

### Step 2: Testing & Verification

- [ ] Confirm findings.md exists and references all Phase 59 FR-STA items

### Step 3: Documentation & Delivery

- [ ] Link findings from handoff workflow section
- [ ] Create `.DONE`

## Completion Criteria

- [ ] `findings.md` complete with batch IDs, journal excerpts, and task mapping
- [ ] SP-512+ workers can implement without re-reading full incident threads

## Do NOT

- Modify `src/batch/` product code in this task
- Skip journal replay (`spine journal replay` or fixture read)
