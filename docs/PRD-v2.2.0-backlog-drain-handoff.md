# pi-spine v2.2.0 — Post-v2.1 Backlog Drain Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.2.0 Backlog Drain (semver)  
**Last updated:** 2026-07-09  
**Status:** Ready for `create-spine-tasks` decomposition  

**Epic alias:** Phase 64 — SP-REL220 (SP-565–573)

**Prerequisite:** v2.1.0 published (`package.json` `2.1.0`, tag `v2.1.0`).

**Release profile:** minor — 9–13 tasks; docs → bugs → enhancements.

**Naming note:** [`docs/PRD-v2.2-ship-readiness-handoff.md`](PRD-v2.2-ship-readiness-handoff.md) is the **Phase 23–26 ship-readiness feature epic** (SP-205–255) — largely landed. **v2.2.0 semver** is the **post-v2.1 backlog drain** minor release.

---

## 1. Executive summary

v2.1.0 drained 13 backlog items and closed 5 hygiene issues (29 → 24 open). **22 open GitHub issues** remain. Consumer batch `20260709T211740` (pi-smart-router) exposed engine promotion without committed `.DONE` ([#190](https://github.com/beettlle/pi-spine/issues/190)).

**v2.2.0** closes the highest-value remainder: **fail-closed done-marker enforcement**, **operator salvage after abort**, and **hygiene for issues already fixed on `main`**.

**Tagline:** *Fail-closed on `.DONE`, salvage succeeded lanes, ship v2.2.0.*

**Design decision (#190):** **Fail-closed** — block lane merge / batch promotion unless committed `.DONE` exists on the lane task branch. Reject auto-heal and document-only alternatives for this release.

---

## 2. Scope lock

### In scope (Phase 64 — SP-REL220)

| FR | Description |
|----|-------------|
| FR-REL220-01 | Release manifest + regression gate for v2.2.0 |
| FR-REL220-02 | #190 fail-closed `.DONE` before merge/promote (explore + engine) |
| FR-REL220-03 | #158 operator salvage — list salvageable lane commits after abort/dismiss |
| FR-REL220-04 | #158 operator salvage — integrate with gate/conflict handling |
| FR-REL220-05 | GitHub hygiene — close issues fixed on `main` (#128, #129, #146–#150, #175, #185) |

### Deferred (v2.2.1+ / v2.3)

| Item | Rationale |
|------|-----------|
| [#43](https://github.com/beettlle/pi-spine/issues/43) monitoring epic | Epic scope |
| [#117](https://github.com/beettlle/pi-spine/issues/117), [#116](https://github.com/beettlle/pi-spine/issues/116) | v2.3 module split epic |
| [#120](https://github.com/beettlle/pi-spine/issues/120)–[#127](https://github.com/beettlle/pi-spine/issues/127) | Gate maturity / mailbox roadmap |
| [#135](https://github.com/beettlle/pi-spine/issues/135) dashboard DAG | M-sized; deferred in v2.0.0 and v2.1.0 |
| [#160](https://github.com/beettlle/pi-spine/issues/160) stet gate evidence | P3 |

### Non-goals

- Rewriting ship-readiness epic (SP-205–255)
- npm publish without operator approval
- Breaking API changes

---

## 3. Baseline — prerequisites checklist

| Check | Reference |
|-------|-----------|
| v2.1.0 published | `package.json` `2.1.0`, tag `v2.1.0` |
| `spine doctor` green | operator runbook |
| `npm run release:check` green | release operator Phase 5 |
| Open issues baseline | **22** at handoff authoring |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| Done-marker reconcile (#190) | `src/batch/journal-rebuild.mjs`, `src/batch/attached-runner.mjs`, `src/batch/diagnosis-task-done.mjs` |
| Lane merge gate | `src/batch/engine-lanes/merge.mjs`, `src/batch/engine-lanes/review.mjs` |
| Salvage (stall inspect — prior) | `src/batch/salvage.mjs` |
| Salvage (abort integrate — new) | `src/batch/integrate.mjs`, `bin/spine-batch.mjs` (new subcommand) |
| Release gate | `scripts/release-proof-gate.sh`, `package.json` |

---

## 5. GitHub issue intake

| Issue | Priority | Action | Task |
|-------|----------|--------|------|
| [#190](https://github.com/beettlle/pi-spine/issues/190) | P3 (consumer: high) | Implement fail-closed | SP-568, SP-569 |
| [#158](https://github.com/beettlle/pi-spine/issues/158) | P2 | Implement (split) | SP-570, SP-571 |
| [#128](https://github.com/beettlle/pi-spine/issues/128) | P2 | Close (SP-559) | SP-572 |
| [#129](https://github.com/beettlle/pi-spine/issues/129) | P3 | Close (SP-561) | SP-572 |
| [#146](https://github.com/beettlle/pi-spine/issues/146)–[#150](https://github.com/beettlle/pi-spine/issues/150) | P2 | Close (SP-558) | SP-572 |
| [#175](https://github.com/beettlle/pi-spine/issues/175) | P1 | Close (SP-562) | SP-572 |
| [#185](https://github.com/beettlle/pi-spine/issues/185) | doc | Close (SP-560) | SP-572 |

---

## 6. Task decomposition (SP-REL220 ↔ SP-ID)

| SP-REL220 | SP-ID | Slug | Mission | Size | Deps | Closes |
|-----------|-------|------|---------|------|------|--------|
| 001 | SP-565 | rel220-handoff-doc | This handoff doc | S | — | — |
| 002 | SP-566 | rel220-manifest | Operator manifest `docs/release/manifest-v2.2.0.md` | S | SP-565 | — |
| 003 | SP-567 | rel220-regression-gate | Extend release gate for v2.2.0 | S | SP-566 | — |
| 004 | SP-568 | rel220-done-marker-explore | Explore fail-closed paths for #190 | S | SP-566 | — |
| 005 | SP-569 | rel220-done-marker-fail-closed | Fail-closed `.DONE` enforcement (#190) | M | SP-568 | #190 |
| 006 | SP-570 | rel220-salvage-list | `spine batch salvage --dry-run` (#158) | S | SP-567 | partial #158 |
| 007 | SP-571 | rel220-salvage-integrate | Salvage integrate with gates (#158) | M | SP-570 | #158 |
| 008 | SP-572 | rel220-github-hygiene | Close landed issues | S | SP-569, SP-571 | hygiene |
| 009 | SP-573 | rel220-context-capstone | CONTEXT Phase 64 capstone | S | SP-572 | — |

---

## 7. Release execution flow

```text
Phase 0 — Handoff + manifest
  SP-565 (this document)
  SP-566 (operator approves manifest)

Phase 1 — Gate + explore
  SP-567 (regression gate)
  SP-568 (done-marker explore — read-only)

Phase 2 — Implementation
  SP-569 (fail-closed engine — serial on src/batch/)
  SP-570 (salvage list — parallel if disjoint)
  SP-571 (salvage integrate — after SP-570)

Phase 3 — Hygiene + sign-off
  SP-572 (close landed issues on GitHub)
  SP-573 (CONTEXT Phase 64 capstone)

Phase 4 — Publish (operator approval)
  npm run release:check → npm version minor → v2.2.0 tag
```

**Regression gate (all implementation waves):** `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check`

---

## 8. Phase 64 exit criteria

- [ ] All manifest-scoped tasks `.DONE` on `main`
- [ ] `npm run release:check` green before tag
- [ ] Open GitHub issues **22 → <15**
- [ ] #190 closed — fail-closed with regression tests
- [ ] #158 closed — salvage documented in operator runbook
- [ ] Hygiene issues closed with landed commit refs (SP-572)
- [ ] CONTEXT Phase 64 complete; Next Task ID → SP-574
- [ ] `npm version minor` → v2.2.0 (operator approval)

---

## 9. Success metrics

| ID | Metric | Verification |
|----|--------|--------------|
| M-REL220-01 | Open issue delta | `gh issue list --state open` before/after |
| M-REL220-02 | Missing `.DONE` blocks promote | `tests/batch/done-marker-fail-closed.test.mjs` |
| M-REL220-03 | Salvage lists succeeded lanes | `tests/batch/batch-salvage.test.mjs` |
| M-REL220-04 | Hygiene closures | GitHub comments with commit SHA |

---

## 10. Wave run order

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 | SP-565, SP-566 | Handoff + manifest — **operator approval required** |
| 1 | SP-567, SP-568 | Gate + explore — parallel if disjoint |
| 2 | SP-569 | Fail-closed engine — serial `src/batch/` |
| 3 | SP-570 | Salvage list |
| 4 | SP-571 | Salvage integrate |
| 5 | SP-572, SP-573 | Hygiene + capstone |

Run `spine plan SP-565,...,SP-573` after validate for authoritative waves.

---

## 11. Workflow after this document

### 11.1 Author manifest (operator gate)

```text
SP-566 writes docs/release/manifest-v2.2.0.md from this handoff §5–§6.
Operator must set "Operator approved scope: yes" before implementation batch.
```

### 11.2 Execute release sequence

```bash
./scripts/release-proof-gate.sh
spine run sequence SP-565,SP-566,SP-567,SP-568,SP-569,SP-570,SP-571,SP-572,SP-573 --detached
# Operator: spine gate approve between waves; npm version after SP-573
```

### 11.3 Post-release

Update stabilization roadmap metrics with v2.2.0 issue delta. File follow-up epics for deferred backlog (#43, #117, #120–127).

---

## 12. Related documents

| Document | Role |
|----------|------|
| [`docs/PRD-v2.1.0-backlog-drain-handoff.md`](PRD-v2.1.0-backlog-drain-handoff.md) | Prior release (Phase 63) |
| [`docs/PRD-v2.2-ship-readiness-handoff.md`](PRD-v2.2-ship-readiness-handoff.md) | Ship-readiness epic (landed — not this release) |
| [`docs/release/manifest-v2.2.0.md`](release/manifest-v2.2.0.md) | Operator manifest (SP-566) |
| [`spine-tasks/_explore/done-marker-fail-closed/findings.md`](../spine-tasks/_explore/done-marker-fail-closed/findings.md) | #190 explore (SP-568) |
| [`skills/create-spine-tasks/SKILL.md`](../skills/create-spine-tasks/SKILL.md) | Task decomposition workflow |
