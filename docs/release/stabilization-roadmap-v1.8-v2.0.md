# pi-spine stabilization roadmap — v1.8.1 → v2.0.0

**Document type:** Release planning index  
**Product:** pi-spine  
**Last updated:** 2026-07-08  
**Status:** Active  

**Prerequisite:** v1.8.0 release cycle complete on `main`.

**Purpose:** Index four semver stabilization releases that reduce open-issue count release-over-release and move toward **gates-only** automated releases via [`skills/spine-autonomous-operator/SKILL.md`](../../skills/spine-autonomous-operator/SKILL.md).

**Naming note:** [`docs/PRD-v2.0.md`](../PRD-v2.0.md) is the **CDO feature specification** (Contract-Driven Orchestration — already shipped). **v2.0.0** in this roadmap is a **semver automation proof release**, documented in [`PRD-v2.0.0-automation-proof-handoff.md`](../PRD-v2.0.0-automation-proof-handoff.md).

---

## 1. Executive summary

Every pi-spine release since v1.6.0 has filed more GitHub issues than it closed. The v1.8.0 cycle exposed recurring **batch FSM reconciliation** failures (`state_drift`, `engine_orphaned`), **contract verify false positives**, and **release process gaps** (no `release:check` gate, attached-shell orphans).

This roadmap sequences four releases to fix root causes before attempting unattended release automation:

| Release | Profile | Theme | Handoff |
|---------|---------|-------|---------|
| **v1.8.1** | patch | Reconciliation truth | [`PRD-v1.8.1-reconciliation-handoff.md`](../PRD-v1.8.1-reconciliation-handoff.md) |
| **v1.9.0** | minor | Contract & authoring guardrails | [`PRD-v1.9.0-contract-guardrails-handoff.md`](../PRD-v1.9.0-contract-guardrails-handoff.md) |
| **v1.10.0** | minor | Release harness | [`PRD-v1.10.0-release-harness-handoff.md`](../PRD-v1.10.0-release-harness-handoff.md) |
| **v1.10.1** | patch | P1 stabilization + GitHub hygiene | [`PRD-v1.10.1-stabilization-handoff.md`](../PRD-v1.10.1-stabilization-handoff.md) |
| **v2.0.0** | minor (proof) | Gates-only automation proof | [`PRD-v2.0.0-automation-proof-handoff.md`](../PRD-v2.0.0-automation-proof-handoff.md) |

**Tagline:** *Fix truth, fix contracts, fix the harness, then prove gates-only.*

---

## 2. Release dependency chain

```text
v1.8.0 (done)
    └── v1.8.1 — reconciliation FSM (blocks trustworthy automation)
            └── v1.9.0 — contract guardrails (blocks unattended contract verify)
                    └── v1.10.0 — release harness (sequence + release:check)
                            └── v1.10.1 — P1 stabilization (#163, #187) + issue cleanup
                                    └── v2.0.0 — automation proof (dogfood full release)
```

**Hard rule:** Do not run v2.0.0 automation proof until v1.10.1 exit criteria pass (open P1 = 0). Do not run v1.10.0 sequence-based release automation until v1.8.1 and v1.9.0 exit criteria pass. Unattended batches will stall on the same failure classes that blocked v1.7.0 and v1.8.0.

---

## 3. Success metrics (open issues)

Target **net decrease** in open GitHub issues per release:

| After release | Target open issues | Automation level |
|---------------|-------------------|------------------|
| v1.8.0 (baseline) | ~48 | Manual operator recovery common |
| v1.8.1 | ~35 | `spine status --diagnose` always actionable |
| v1.9.0 | ~25 | `spine preflight` blocks bad task packets |
| v1.10.0 | ~15 | `spine run sequence` + gate-only touchpoints |
| v2.0.0 | <10 | Full autonomous proof; gates + publish approval only |

Measure with: `gh issue list --state open | wc -l` at release start and after publish.

---

## 4. Release profile rules

Cite [`skills/spine-release-operator/references/release-profiles.md`](../../skills/spine-release-operator/references/release-profiles.md).

| Release | Profile | Task budget | Size policy |
|---------|---------|-------------|-------------|
| v1.8.1 | patch | 5–8 tasks | **S only** — split or defer any M/L staged work |
| v1.9.0 | minor | 10–15 tasks | S/M; docs-first wave, then 3 bugs : 1 enhancement |
| v1.10.0 | minor | 10–15 tasks | S/M; harness + lifecycle fixes |
| v2.0.0 | minor (proof) | 5–8 tasks | Curated manifest; not backlog drain |

**Selection order (all releases):** documentation → bugs → enhancements (if profile allows).

Per-release execution manifests: [`skills/spine-release-operator/references/release-manifest-template.md`](../../skills/spine-release-operator/references/release-manifest-template.md).

---

## 5. Operator policy (all stabilization releases)

| Policy | Rationale | Issue |
|--------|-----------|-------|
| **Detached resume default** for release batches | Short-lived shells + `--attached` → SIGKILL orphans | [#185](https://github.com/beettlle/pi-spine/issues/185) |
| **Never background** `spine batch resume --attached` | Exit 137 orphans engine | [#163](https://github.com/beettlle/pi-spine/issues/163) |
| **No M-sized refactor waves** in patch releases | v1.8.0 LOC-split collateral caused contract failures | [#187](https://github.com/beettlle/pi-spine/issues/187) |
| **Scoped `testCommand`** in every release task | `npm test -- <file>` runs full suite | [#141](https://github.com/beettlle/pi-spine/issues/141) |
| **`spine gate approve` before `spine integrate`** | Hard rule in autonomous + release operator skills | — |

---

## 6. Issue assignment by release

### v1.8.1 — Reconciliation

| Type | Issues |
|------|--------|
| Bugs | [#170](https://github.com/beettlle/pi-spine/issues/170), [#184](https://github.com/beettlle/pi-spine/issues/184), [#163](https://github.com/beettlle/pi-spine/issues/163), [#165](https://github.com/beettlle/pi-spine/issues/165), [#166](https://github.com/beettlle/pi-spine/issues/166), [#100](https://github.com/beettlle/pi-spine/issues/100) (partial via SP-445–447), [#103](https://github.com/beettlle/pi-spine/issues/103) (SP-449), [#96](https://github.com/beettlle/pi-spine/issues/96) (SP-442) |
| UX/docs | [#186](https://github.com/beettlle/pi-spine/issues/186), [#168](https://github.com/beettlle/pi-spine/issues/168) |

### v1.9.0 — Contract guardrails

| Type | Issues |
|------|--------|
| Bugs | [#187](https://github.com/beettlle/pi-spine/issues/187), [#171](https://github.com/beettlle/pi-spine/issues/171), [#174](https://github.com/beettlle/pi-spine/issues/174), [#105](https://github.com/beettlle/pi-spine/issues/105), [#62](https://github.com/beettlle/pi-spine/issues/62), [#63](https://github.com/beettlle/pi-spine/issues/63) |
| Authoring | [#141](https://github.com/beettlle/pi-spine/issues/141)–[#144](https://github.com/beettlle/pi-spine/issues/144), [#159](https://github.com/beettlle/pi-spine/issues/159) |

### v1.10.0 — Release harness

| Type | Issues |
|------|--------|
| Bugs | [#173](https://github.com/beettlle/pi-spine/issues/173), [#167](https://github.com/beettlle/pi-spine/issues/167) |
| Enhancements | [#175](https://github.com/beettlle/pi-spine/issues/175), [#156](https://github.com/beettlle/pi-spine/issues/156), [#169](https://github.com/beettlle/pi-spine/issues/169), [#185](https://github.com/beettlle/pi-spine/issues/185), [#54](https://github.com/beettlle/pi-spine/issues/54) |

### v2.0.0 — Automation proof

| Type | Issues |
|------|--------|
| Curated | Remaining P2 bugs + [#99](https://github.com/beettlle/pi-spine/issues/99), [#106](https://github.com/beettlle/pi-spine/issues/106) if in proof manifest |

---

## 7. Deferred backlog (explicitly out of scope until v2.0.0 proof passes)

| Item | Type | Defer to |
|------|------|----------|
| [#43](https://github.com/beettlle/pi-spine/issues/43) Operator monitoring epic | enhancement | Post-v2.0.0 or v2.0.0 proof scope only (SP-360–363 subset) |
| [#117](https://github.com/beettlle/pi-spine/issues/117) v2.3 batch module split | epic | Post-v2.0.0 |
| [#120](https://github.com/beettlle/pi-spine/issues/120)–[#129](https://github.com/beettlle/pi-spine/issues/129) Gate maturity / journal hardening | enhancement | Post-v2.0.0 |
| Phase 54 perf (SP-451–456) | staged tasks | v1.10.0+ only if blocking proof |
| Phase 46–57 UX/dashboard backlog | staged tasks | Post-v2.0.0 unless release-scoped |
| [#135](https://github.com/beettlle/pi-spine/issues/135) Dashboard task DAG | enhancement | Post-v2.0.0 |
| [#119](https://github.com/beettlle/pi-spine/issues/119) best-of-n external repos | bug | Post-v2.0.0 |
| [#130](https://github.com/beettlle/pi-spine/issues/130) post-merge git restore | bug | v1.10.0 or v2.0.0 if manifest room |
| [#145](https://github.com/beettlle/pi-spine/issues/145)–[#150](https://github.com/beettlle/pi-spine/issues/150) Skill template polish | enhancement | v1.9.0+ backlog |
| [#116](https://github.com/beettlle/pi-spine/issues/116) integrate checkout helper | enhancement | Post-v2.0.0 |
| [#158](https://github.com/beettlle/pi-spine/issues/158) Operator salvage | enhancement | Post-v2.0.0 |
| [#160](https://github.com/beettlle/pi-spine/issues/160), [#161](https://github.com/beettlle/pi-spine/issues/161) | enhancement | Post-v2.0.0 |
| [#134](https://github.com/beettlle/pi-spine/issues/134) Heartbeat dark during subprocess | enhancement | Phase 54 / post-v2.0.0 |

---

## 8. CONTEXT.md phase mapping

| Phase | Release | Epic alias | Task ID range |
|-------|---------|------------|---------------|
| 59 | v1.8.1 | SP-REC | SP-511+ (new) + SP-442, SP-445–449 (staged) |
| 60 | v1.9.0 | SP-CTR | SP-478–479, SP-410–417 subset + new |
| 61 | v1.10.0 | SP-HARNESS | SP-387–392, SP-350–351, SP-360–362 + new |
| 62 | v2.0.0 | SP-AUTO | Proof manifest tasks |

---

## 9. Workflow

1. Read the handoff for the target release.
2. Run `create-spine-tasks` to decompose into `spine-tasks/SP-*` packets.
3. Update `spine-tasks/CONTEXT.md` phase table and `dependencies.json`.
4. Optional explore: `spine-tasks/_explore/{slug}/findings.md` before v1.8.1 decomposition.
5. Validate: `spine tasks validate`, `spine tasks analyze`, `spine plan <scope>`.
6. Execute via `spine-release-operator` with filled release manifest.
7. After publish, record open-issue count and exit criteria in release post-mortem.

---

## 10. Related documents

| Document | Role |
|----------|------|
| [`PRD.md`](../PRD.md) | Base orchestrator spec (authoritative) |
| [`PRD-v2.1-reliability-handoff.md`](../PRD-v2.1-reliability-handoff.md) | Prior reliability epic (Phase 22 — landed; regressions tracked in v1.8.1) |
| [`docs/features/stet-feedback-loop-brief.md`](../features/stet-feedback-loop-brief.md) | Stet optimizer path (optional v2.0.0 scope) |
| [`docs/adoption/operator-runbook.md`](../adoption/operator-runbook.md) | Recovery procedures (update per release) |
