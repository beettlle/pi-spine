# Task: SP-402 — Attached evidence gate resilience

**Created:** 2026-07-01
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Gate FSM + evidence collection ordering; attached land-loop reliability.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #70**: when `spine batch resume --force --attached` reaches post-merge finalize, `collectEvidenceBundle` runs full `npm test` (~3 min). If the attached CLI is killed before collection finishes, the batch stays `phase: running` / `needs_integrate` with **no gate record** despite all tasks succeeded and orch merged.

**Required behavior:**

1. Open integrate gate after **core** evidence (summary + diff-stat) before long-running test/coverage commands.
2. Extended evidence failures or interruption must not roll back an opened gate.
3. Attached land-loop milestones surface evidence collection progress (`gate.evidence_collecting` / `gate.evidence_completed`).
4. Resume/post-merge limbo finalize can complete land loop when partial evidence dir exists.

**Closes:** [#70](https://github.com/beettlle/pi-spine/issues/70)

## Dependencies

None

## Context to Read First

- GitHub issue #70
- `src/batch/evidence.mjs` (`collectEvidenceBundle`)
- `src/batch/gate.mjs` (`openIntegrateGate`)
- `src/batch/post-merge-limbo.mjs` (`finalizeBatchForIntegrate`)
- `src/batch/attached-runner.mjs` (`ATTACHED_LAND_LOOP_MILESTONE_TYPES`)
- Batch `20260701T170610` recovery timeline

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/evidence.mjs`
- `src/batch/gate.mjs`
- `src/batch/attached-runner.mjs`
- `tests/batch/evidence-gate-resilience.test.mjs`
- `tests/batch/gate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/evidence-gate-resilience.test.mjs tests/batch/gate.test.mjs tests/batch/evidence.test.mjs` |
| fileScopeMustChange | `spine-tasks/SP-402-attached-evidence-gate-resilience/STATUS.md` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/evidence-gate-resilience.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Re-read issue #70 and batch `20260701T170610` partial evidence dir (no `.complete`)
- [ ] Trace `openIntegrateGate` → `collectEvidenceBundle` call order

### Step 1: Split evidence collection

- [ ] Add `collectCoreEvidenceBundle` (summary, diff-stat, worker log refs) — no `.complete` yet
- [ ] Add `collectExtendedEvidenceBundle` (test/build/coverage commands) — append refs
- [ ] Add `finalizeEvidenceBundleComplete` — write `.complete` atomically
- [ ] Keep `collectEvidenceBundle` as full wrapper for backward compatibility

### Step 2: Gate opens before extended evidence

- [ ] In `openIntegrateGate`: persist gate + journal `gate.opened` after core evidence
- [ ] Run extended evidence; update gate `evidenceRefs` on success; swallow/log extended failures without deleting gate
- [ ] Journal `gate.evidence_collecting` / `gate.evidence_completed` (or `gate.evidence_failed`)
- [ ] Add evidence milestone types to `ATTACHED_LAND_LOOP_MILESTONE_TYPES`

### Step 3: Testing & Verification

- [ ] Add `tests/batch/evidence-gate-resilience.test.mjs`: gate exists when extended command fails; core does not write `.complete` alone
- [ ] Extend `gate.test.mjs` if needed for two-phase open
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 4: Documentation & Delivery

- [ ] Note attached evidence behavior in `docs/adoption/operator-runbook.md` land-loop section (if affected)
- [ ] Close issue #70
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (unless runbook land-loop timing note needed)

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Killing attached CLI during extended evidence still leaves gate record when core evidence succeeded
- [ ] Issue #70 closed

## Git Commit Convention

- `feat(SP-402): complete Step N — description`
- `fix(SP-402): description`
- `test(SP-402): description`

## Do NOT

- Remove test evidence collection entirely for integrate gates
- Block gate open on coverage command failure when core evidence is present
- Change integrate approval semantics

---

## Amendments (Added During Execution)
