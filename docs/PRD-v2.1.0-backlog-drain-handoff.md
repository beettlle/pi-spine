# pi-spine v2.1.0 — Post-Proof Backlog Drain Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.1.0 Backlog Drain (semver)  
**Last updated:** 2026-07-09  
**Status:** Ready for `create-spine-tasks` decomposition  

**Epic alias:** Phase 63 — SP-REL210 (SP-552–564)

**Prerequisite:** v2.0.0 automation proof complete ([`PRD-v2.0.0-automation-proof-handoff.md`](PRD-v2.0.0-automation-proof-handoff.md)); tag `v2.0.0` published.

**Release profile:** minor — 10–15 tasks; docs → bugs → enhancements.

**Naming note:** [`docs/PRD-v2.1-reliability-handoff.md`](PRD-v2.1-reliability-handoff.md) is the **Phase 22 feature epic** (SP-171–191) — already landed. **v2.1.0 semver** is the **post-proof backlog drain** minor release.

---

## 1. Executive summary

v2.0.0 proved gates-only automation with a curated 9-task manifest. **29 open GitHub issues** remain. Many are **already fixed on `main`** but not closed; others are **partial fixes** (worktree cleanup, agent detached UX, skill authoring polish).

**v2.1.0** drains the highest-value backlog items without epics (#43, #117, #120–127) or M-sized dashboard work (#135).

**Tagline:** *Close landed issues, finish operator surfaces, ship v2.1.0.*

---

## 2. Scope lock

### In scope (Phase 63 — SP-REL210)

| FR | Description |
|----|-------------|
| FR-REL210-01 | Release manifest + regression gate for v2.1.0 |
| FR-REL210-02 | Complete #169 worktree cleanup (abort path, empty shells, optional CLI) |
| FR-REL210-03 | #157 CI guard — reject reconcile tests using `process.cwd()` without fixture |
| FR-REL210-04 | #148 duplicate step number validator in `parse-prompt.mjs` + skill guidance |
| FR-REL210-05 | #146–#150 `create-spine-tasks` authoring polish (bundled) |
| FR-REL210-06 | #128 `spine doctor` duplicate-install + argv Pi CLI resolution |
| FR-REL210-07 | #185 agent detached docs + dashboard parent-exit diagnosis hint |
| FR-REL210-08 | #129 component maturity matrix (L0–L4) |
| FR-REL210-09 | #175 optional `preversion` → `release:check` hook |
| FR-REL210-10 | GitHub hygiene — close issues fixed on `main` (#130, #171, #156, #141, #125) |

### Deferred (v2.1.1+ / v2.2)

| Item | Rationale |
|------|-----------|
| [#43](https://github.com/beettlle/pi-spine/issues/43) monitoring epic | Epic scope |
| [#117](https://github.com/beettlle/pi-spine/issues/117) v2.3 module split | Epic — FR-SHIP-02 |
| [#120](https://github.com/beettlle/pi-spine/issues/120)–[#127](https://github.com/beettlle/pi-spine/issues/127) | Gate maturity / mailbox roadmap |
| [#135](https://github.com/beettlle/pi-spine/issues/135) dashboard DAG | M-sized; deferred in v2.0.0 |
| [#158](https://github.com/beettlle/pi-spine/issues/158) operator salvage | New command surface — M |
| [#160](https://github.com/beettlle/pi-spine/issues/160) stet gate evidence | P3 |

### Non-goals

- Second gates-only proof release
- npm publish without operator approval
- Breaking API changes

---

## 3. Baseline — prerequisites checklist

| Check | Reference |
|-------|-----------|
| v2.0.0 published | `package.json` `2.0.0`, CONTEXT Phase 62 |
| `spine doctor` green | operator runbook |
| `npm run release:check` green | release operator Phase 5 |
| Open issues baseline | 29 at manifest authoring |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| Worktree cleanup | `src/batch/worktree.mjs`, `src/batch/lifecycle.mjs`, `src/batch/abort.mjs` |
| PROMPT parse | `src/tasks/parse-prompt.mjs` |
| Doctor | `bin/spine-doctor.mjs`, `src/doctor/` |
| Dashboard diagnosis | `src/dashboard/snapshot.mjs`, `src/batch/diagnosis.mjs` |
| Release gate | `scripts/release-proof-gate.sh`, `package.json` |
| Skill authoring | `skills/create-spine-tasks/SKILL.md`, `references/prompt-template.md` |

---

## 5. GitHub issue intake

| Issue | Priority | Action | Task |
|-------|----------|--------|------|
| [#169](https://github.com/beettlle/pi-spine/issues/169) | P2 | Implement | SP-555 |
| [#157](https://github.com/beettlle/pi-spine/issues/157) | P2 | Implement | SP-556 |
| [#148](https://github.com/beettlle/pi-spine/issues/148) | P2 | Implement | SP-557 |
| [#146](https://github.com/beettlle/pi-spine/issues/146)–[#150](https://github.com/beettlle/pi-spine/issues/150) | P2 | Implement | SP-558 |
| [#128](https://github.com/beettlle/pi-spine/issues/128) | P2 | Implement | SP-559 |
| [#185](https://github.com/beettlle/pi-spine/issues/185) | doc/P1 | Implement | SP-560 |
| [#129](https://github.com/beettlle/pi-spine/issues/129) | P3 | Implement | SP-561 |
| [#175](https://github.com/beettlle/pi-spine/issues/175) | P1 | Partial hook | SP-562 |
| [#130](https://github.com/beettlle/pi-spine/issues/130) | bug | Close (SP-483) | SP-563 |
| [#171](https://github.com/beettlle/pi-spine/issues/171) | bug | Close (SP-526) | SP-563 |
| [#156](https://github.com/beettlle/pi-spine/issues/156) | P1 | Close (SP-531) | SP-563 |
| [#141](https://github.com/beettlle/pi-spine/issues/141) | P1 | Verify/close | SP-563 |
| [#125](https://github.com/beettlle/pi-spine/issues/125) | P2 | Verify vs SP-352/353 | SP-563 |

---

## 6. Task decomposition (SP-REL210 ↔ SP-ID)

| SP-REL210 | SP-ID | Slug | Mission | Size | Deps | Closes |
|-----------|-------|------|---------|------|------|--------|
| 001 | SP-552 | rel210-handoff-doc | This handoff doc | S | — | — |
| 002 | SP-553 | rel210-manifest | Operator manifest `docs/release/manifest-v2.1.0.md` | S | SP-552 | — |
| 003 | SP-554 | rel210-regression-gate | Extend release gate for v2.1.0 | S | SP-553 | — |
| 004 | SP-555 | rel210-worktree-cleanup | #169 worktree cleanup completion | S | SP-553 | #169 |
| 005 | SP-556 | rel210-ci-guard-cwd | #157 reconcile test cwd guard | S | SP-553 | #157 |
| 006 | SP-557 | rel210-duplicate-step-validator | #148 duplicate step validator | S | SP-553 | #148 |
| 007 | SP-558 | rel210-skill-authoring-polish | #146–#150 skill polish | S | SP-553 | partial |
| 008 | SP-559 | rel210-doctor-duplicate-install | #128 doctor checks | S | SP-553 | #128 |
| 009 | SP-560 | rel210-agent-detached-ux | #185 docs + diagnosis UX | S | SP-553 | #185 |
| 010 | SP-561 | rel210-maturity-matrix | #129 maturity matrix doc | S | SP-553 | #129 |
| 011 | SP-562 | rel210-preversion-hook | #175 preversion hook | S | SP-554 | partial #175 |
| 012 | SP-563 | rel210-github-hygiene | Close landed issues | S | SP-555–562 | hygiene |
| 013 | SP-564 | rel210-context-capstone | CONTEXT Phase 63 capstone | S | leaves | — |

---

## 7. Release execution flow

```text
Phase 0 — Handoff + manifest
  SP-552 (this document)
  SP-553 (operator approves manifest)

Phase 1 — Gate + implementation
  SP-554 (regression gate — extends release-proof-gate.sh)
  SP-555, SP-556, SP-557 (parallel — bugs/enhancements)
  SP-558, SP-559, SP-560, SP-561 (parallel — docs + doctor)
  SP-562 (preversion hook — after SP-554)

Phase 2 — Hygiene + sign-off
  SP-563 (close landed issues on GitHub)
  SP-564 (CONTEXT Phase 63 capstone)

Phase 3 — Publish (operator approval)
  npm run release:check → npm version minor → v2.1.0 tag
```

**Regression gate (all implementation waves):** `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check`

---

## 8. Phase 63 exit criteria

- [ ] All manifest-scoped tasks `.DONE` on `main`
- [ ] `npm run release:check` green before tag
- [ ] Open GitHub issues decreased vs baseline 29
- [ ] Hygiene issues closed with landed commit refs (SP-563)
- [ ] CONTEXT Phase 63 complete; Next Task ID → SP-565
- [ ] `npm version minor` → v2.1.0 (operator approval)

---

## 9. Success metrics

| ID | Metric | Verification |
|----|--------|--------------|
| M-REL210-01 | Open issue delta | `gh issue list --state open` before/after |
| M-REL210-02 | Worktree cleanup on abort | `worktree-cleanup-abort.test.mjs` |
| M-REL210-03 | Duplicate step rejected | `parse-prompt.test.mjs` |
| M-REL210-04 | Doctor duplicate install | `doctor-duplicate-install.test.mjs` |

---

## 10. Wave run order

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 | SP-552, SP-553 | Handoff + manifest — **operator approval required** |
| 1 | SP-554, SP-555, SP-556, SP-557 | Gate + worktree/CI/validator — parallel if disjoint |
| 2 | SP-558, SP-559, SP-560, SP-561 | Skill polish + doctor + detached UX + maturity matrix |
| 3 | SP-562 | Preversion hook — depends on SP-554 gate |
| 4 | SP-563 | GitHub hygiene — after implementation tasks |
| 5 | SP-564 | CONTEXT capstone — leaves only |

Run `spine plan SP-552,...,SP-564` after validate for authoritative waves.

---

## 11. Workflow after this document

### 11.1 Author manifest (operator gate)

```text
SP-553 writes docs/release/manifest-v2.1.0.md from this handoff §5–§6.
Operator must set "Operator approved scope: yes" before implementation batch.
```

### 11.2 Execute release sequence

```bash
./scripts/release-proof-gate.sh   # or v2.1.0 gate after SP-554
spine run sequence SP-552,SP-553,SP-554,SP-555,SP-556,SP-557,SP-558,SP-559,SP-560,SP-561,SP-562,SP-563,SP-564 --detached
# Operator: spine gate approve between waves; npm version after SP-564
```

### 11.3 Post-release

Update [`docs/release/stabilization-roadmap-v1.8-v2.0.md`](release/stabilization-roadmap-v1.8-v2.0.md) metrics table with v2.1.0 issue delta. File follow-up epics for deferred backlog (#43, #117, #120–127).

---

## 12. Related documents

| Document | Role |
|----------|------|
| [`docs/PRD-v2.0.0-automation-proof-handoff.md`](PRD-v2.0.0-automation-proof-handoff.md) | Prior release — gates-only proof (Phase 62) |
| [`docs/PRD-v2.1-reliability-handoff.md`](PRD-v2.1-reliability-handoff.md) | Phase 22 reliability epic (landed — not this release) |
| [`docs/release/stabilization-roadmap-v1.8-v2.0.md`](release/stabilization-roadmap-v1.8-v2.0.md) | Master stabilization roadmap |
| [`docs/release/manifest-v2.1.0.md`](release/manifest-v2.1.0.md) | Operator manifest (SP-553) |
| [`skills/spine-release-operator/references/release-manifest-template.md`](../skills/spine-release-operator/references/release-manifest-template.md) | Manifest format |
| [`spine-tasks/CONTEXT.md`](../spine-tasks/CONTEXT.md) | Phase 63 task table |
