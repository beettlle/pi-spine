# pi-spine v2.1 — Reliability Epic Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.1 Reliability  
**Last updated:** 2026-06-11  
**Status:** Ready for `create-spine-tasks` decomposition  

**Epic alias:** Phase 22 — SP-REL (SP-171–SP-191)

**Prerequisite:** Phase 20b complete (SP-141–SP-170 on `main`).

---

## 1. Executive summary

pi-spine v2.0 delivered Contract-Driven Orchestration (validate, contract verify, final verdict, handoff, metrics). **Operational reliability on real `pi` workers** still lags Taskplane/Babysitter because:

- 699 automated tests run with `SPINE_WORKER_STUB=1` only
- Batch-state cache can drift from journal (retry-state-drift incident)
- Journal rebuild deferred from v2.0 (PRD §11.4)
- `agentSession` worker backend remains experimental
- npm publish / PATH friction blocks adoption
- Detached-by-default batches confuse operators

**Phase 22** closes these gaps with journal-derived truth, atomic transitions, real-pi CI, agentSession promotion, and operator UX hardening.

**Tagline:** *Rebuild from journal, prove with real pi, fail loud on drift.*

---

## 2. Scope lock

### In scope (Phase 22 — SP-171–SP-191)

| FR | Description |
|----|-------------|
| FR-REL-01 | Journal timeline reader for task/batch events |
| FR-REL-02 | Rebuild task/segment status from journal |
| FR-REL-03 | `state_drift` diagnosis when cache ≠ journal rebuild |
| FR-REL-04 | Atomic `recordTaskTransition()` (journal + batch-state) |
| FR-REL-05 | Real-pi CI workflow (scheduled + manual) |
| FR-REL-06 | Multi-task real-pi adoption fixture |
| FR-REL-07 | Tier 3 consumer pilot sign-off template |
| FR-REL-08 | agentSession doctor/preflight readiness |
| FR-REL-09 | agentSession abort fail-loud + journal |
| FR-REL-10 | Detached resume `--wait-terminal` default after orphan |
| FR-REL-11 | Doctor worktree/devcontainer health checks |
| FR-REL-12 | Attached-first operator runbook guidance |
| FR-REL-13 | npm publish prep checklist |
| FR-REL-14 | Optional `lanes.autoIntegrateBetweenWaves` |
| FR-REL-15 | `contract.mode: required` dogfood flip |
| FR-REL-16 | `handoff.autoWriteOn: ["session_start"]` |

### Deferred (v2.2+)

- Full batch-state rebuild without cache seed (structural fields from journal only)
- `spine settings suggest-models` from metrics
- npm publish execution (checklist only in Phase 22)

### Non-goals

- Replacing subprocess `pi -p` workers entirely
- Taskplane `/orch` migration automation

---

## 3. Code anchors (reuse)

| Concern | Primary files |
|---------|---------------|
| Journal | `src/batch/journal.mjs` |
| Batch state | `src/batch/state.mjs`, `src/batch/batch-state-io.mjs` |
| Reconcile | `src/batch/reconcile.mjs`, `src/batch/diagnosis.mjs` |
| Orphan detect | `src/batch/orphan-detect.mjs` |
| Detached start | `src/batch/detached-start.mjs` |
| agentSession | `src/batch/agent-session-worker.mjs` |
| Doctor | `bin/spine-doctor.mjs` |
| Real-pi E2E | `scripts/real-pi-adoption-e2e.sh` |
| Incidents | `tests/fixtures/incidents/*.json` |

---

## 4. Task decomposition (SP-REL ↔ SP-171+)

| SP-REL | SP-ID | Slug | Mission | Deps |
|--------|-------|------|---------|------|
| 001 | SP-171 | rel-handoff-doc | This handoff doc | SP-170 |
| 002 | SP-172 | rel-explore-findings | Explore findings artifact | SP-171 |
| 003 | SP-173 | rel-journal-reader | `readJournalTimeline()` | SP-172 |
| 004 | SP-174 | rel-journal-rebuild | `rebuildBatchStateFromJournal()` | SP-173 |
| 005 | SP-175 | rel-reconcile-drift | `state_drift` diagnosis + detect | SP-174 |
| 006 | SP-176 | rel-transition-helper | `recordTaskTransition()` | SP-175 |
| 007 | SP-177 | rel-transition-wire | Wire engine/resume/retry | SP-176 |
| 008 | SP-178 | rel-real-pi-ci | `.github/workflows/real-pi.yml` | SP-172 |
| 009 | SP-179 | rel-real-pi-fixture | Multi-task adoption fixture | SP-178 |
| 010 | SP-180 | rel-pilot-signoff | Consumer pilot report template | SP-179 |
| 011 | SP-181 | rel-agentsession-doctor | agentSession doctor/preflight | SP-177 |
| 012 | SP-182 | rel-agentsession-abort | Abort fail-loud | SP-181 |
| 013 | SP-183 | rel-agentsession-dogfood | agentSession dogfood report | SP-182 |
| 014 | SP-184 | rel-wait-terminal | Resume wait-terminal default | SP-175 |
| 015 | SP-185 | rel-doctor-worktree | Doctor worktree health | SP-172 |
| 016 | SP-186 | rel-runbook-attached | Attached-first runbook | SP-185 |
| 017 | SP-187 | rel-npm-publish-prep | npm publish checklist | SP-180 |
| 018 | SP-188 | rel-auto-integrate | `autoIntegrateBetweenWaves` | SP-177 |
| 019 | SP-189 | rel-contract-required | Flip contract.mode required | SP-170 |
| 020 | SP-190 | rel-handoff-autowrite | handoff.autoWriteOn session_start | SP-189 |
| — | SP-191 | rel-context-phase22 | CONTEXT + dependencies.json | leaves |

---

## 5. Wave run order

```text
SP-170 (done)
  └── SP-171 (handoff)
        └── SP-172 (explore)
              ├── SP-173 → SP-174 → SP-175 → SP-176 → SP-177
              ├── SP-178 → SP-179 → SP-180
              ├── SP-185 → SP-186
              └── SP-189 → SP-190
SP-177 → SP-181 → SP-182 → SP-183
SP-175 → SP-184
SP-180 → SP-187
SP-177 → SP-188
leaves → SP-191
```

### Suggested batches (≤3 tasks)

| Batch | Tasks |
|-------|-------|
| 1 | SP-171 |
| 2 | SP-172 |
| 3–7 | SP-173, SP-174, SP-175, SP-176, SP-177 (serial) |
| 8 | SP-178 |
| 9 | SP-179, SP-185 |
| 10–20 | per §4 table |

**Regression gate:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

**Real-pi gate:** `unset SPINE_WORKER_STUB && ./scripts/real-pi-adoption-e2e.sh --batch`

---

## 6. Phase 22 exit criteria

- [ ] Journal rebuild matches incident fixtures for task status
- [ ] `state_drift` surfaced in `spine status --diagnose`
- [ ] Real-pi CI workflow documented and runnable
- [ ] agentSession abort journals failures
- [ ] Operator runbook attached-first section
- [ ] CONTEXT Phase 22 complete; Next Task ID → SP-192

---

## 7. Success metrics

| ID | Metric | Verification |
|----|--------|--------------|
| M-REL-01 | Journal rebuild parity | `journal-rebuild.test.mjs` |
| M-REL-02 | No post-retry drift | `retry-state-drift.test.mjs` |
| M-REL-03 | Real-pi CI | `.github/workflows/real-pi.yml` |
| M-REL-04 | Orphan resume wait-terminal | `detached-resume-wait.test.mjs` |
| M-REL-05 | agentSession abort surfaced | `agent-session-abort.test.mjs` |
| M-REL-06 | Doctor worktree checks | `worktree-health.test.mjs` |
