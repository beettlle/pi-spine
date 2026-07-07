# pi-spine v2.0.0 — Automation Proof Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.0.0 Automation Proof (semver)  
**Last updated:** 2026-07-07  
**Status:** Ready for `create-spine-tasks` decomposition  

**Epic alias:** Phase 62 — SP-AUTO (SP-538+)

**Prerequisite:** v1.8.1, v1.9.0, and v1.10.0 exit criteria met.

**Release profile:** minor (proof) — curated manifest 5–8 tasks; **not** backlog drain.

---

## 1. Executive summary

**This document is not [`docs/PRD-v2.0.md`](PRD-v2.0.md).** PRD v2.0 defined Contract-Driven Orchestration (validate, contract verify, handoff, metrics) — **already shipped** in Phase 20b (SP-141–170).

**v2.0.0 semver** is the **automation proof release**: dogfood a complete release cycle via [`skills/spine-autonomous-operator/SKILL.md`](../../skills/spine-autonomous-operator/SKILL.md) (or release-operator with sequence harness) where the operator's only actions are:

1. **Integrate gate approvals** (`spine gate approve`)
2. **Publish approval** (`npm version` + tag push)

No manual `pause`, `retry`, `resume --force`, or batch-state JSON surgery during waves.

**Tagline:** *Prove gates-only — then call it automation.*

---

## 2. Scope lock

### In scope (Phase 62 — SP-AUTO)

| FR | Description |
|----|-------------|
| FR-STA-30 | Curated proof-release manifest (3 bugs + 1 doc + 1 enhancement) |
| FR-STA-31 | Unattended wave execution via `spine run sequence --auto-approve-gate --detached` |
| FR-STA-32 | Post-release metrics: open-issue delta, batch post-mortem, journal export |
| FR-STA-33 | Automation sign-off checklist in `docs/release/` |
| FR-STA-34 | Operator monitoring runbook integration (SP-363) |
| FR-STA-35 | Proof regression gate script (reusable for future releases) |

### Proof manifest composition (operator-approved before batch)

| Bucket | Count | Source |
|--------|-------|--------|
| Bug fixes | 3 | Remaining P2 from open backlog (e.g. #99, #106, #130 — operator picks at manifest time) |
| Documentation | 1 | e.g. SP-363 operator monitoring runbook or detached policy capstone |
| Enhancement | 1 | Single user-visible improvement (e.g. #99 plan pending UX) |

**Hard limit:** 5–8 tasks, max 2 waves, ≤4 parallel lanes, all S-sized unless operator override.

### Deferred (post-v2.0.0)

| Item | Rationale |
|------|-----------|
| [#117](https://github.com/beettlle/pi-spine/issues/117) v2.3 module split | Epic — not proof scope |
| [#120](https://github.com/beettlle/pi-spine/issues/120)–[#129](https://github.com/beettlle/pi-spine/issues/129) Gate maturity | Post-proof roadmap |
| Phase 54 perf (SP-451–456) | Unless blocking proof monitoring |
| [#43](https://github.com/beettlle/pi-spine/issues/43) full monitoring epic | SP-360–363 subset only |
| [`docs/features/stet-feedback-loop-brief.md`](features/stet-feedback-loop-brief.md) | Only if stet findings exist during proof |

### Non-goals

- New product features beyond manifest
- Breaking API changes
- Major version semantic for CDO (already v2.0 feature layer)
- Unattended `npm publish` without operator approval

---

## 3. Baseline — prerequisites checklist

Before starting v2.0.0 proof batch, verify:

| Check | Reference |
|-------|-----------|
| v1.8.1 incident replay green | [`PRD-v1.8.1-reconciliation-handoff.md`](PRD-v1.8.1-reconciliation-handoff.md) §10 |
| v1.9.0 validate blocks bad testCommand | [`PRD-v1.9.0-contract-guardrails-handoff.md`](PRD-v1.9.0-contract-guardrails-handoff.md) §10 |
| v1.10.0 sequence + release:check wired | [`PRD-v1.10.0-release-harness-handoff.md`](PRD-v1.10.0-release-harness-handoff.md) §10 |
| `spine doctor` green | Operator runbook |
| `gitnexus status` up-to-date | release-operator Pre-work |
| Real-pi available or documented skip | `.github/workflows/real-pi.yml` |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| Sequence proof run | `src/batch/sequence-runner.mjs`, `skills/spine-release-operator/SKILL.md` |
| Autonomous operator | `skills/spine-autonomous-operator/SKILL.md` |
| Post-mortem | `src/batch/post-mortem.mjs`, TP-022 patterns |
| Journal export | `src/cli/journal-export.mjs` |
| Release docs | `docs/release/`, `docs/release/npm-publish.md` |
| Metrics | `.spine/run-metrics.jsonl`, `spine metrics show` |

---

## 5. GitHub issue intake (curated at manifest time)

Proof release **does not** close all open issues. Operator selects from backlog at Phase 0 manifest approval.

**Suggested candidates (P2, S-sized, disjoint scope):**

| Issue | Title | Fit |
|-------|-------|-----|
| [#99](https://github.com/beettlle/pi-spine/issues/99) | Plan pending empty backlog UX | Enhancement |
| [#106](https://github.com/beettlle/pi-spine/issues/106) | Batch size guidance wording | Enhancement |
| [#130](https://github.com/beettlle/pi-spine/issues/130) | post-merge sync git restore | Bug |
| [#161](https://github.com/beettlle/pi-spine/issues/161) | Dashboard retry-then-succeed FAILED display | Bug |
| [#119](https://github.com/beettlle/pi-spine/issues/119) | best-of-n external repos | Bug (if in scope) |

**Manifest documents final picks** in `docs/release/manifest-v2.0.0-proof.md`.

---

## 6. Task decomposition (SP-AUTO ↔ SP-ID)

| SP-AUTO | SP-ID | Slug | Mission | Size | Deps | Closes |
|---------|-------|------|---------|------|------|--------|
| 001 | SP-538 | auto-proof-manifest | Write operator-approved proof manifest `docs/release/manifest-v2.0.0-proof.md` | S | — | — |
| 002 | SP-539 | auto-signoff-checklist | `docs/release/automation-signoff-checklist.md` | S | — | — |
| 003 | SP-540 | auto-regression-gate-script | `scripts/release-proof-gate.sh` — prereq checks before proof batch | S | SP-539 | — |
| 004 | SP-363 | operator-monitoring-runbook | Operator monitoring runbook (Phase 46) | S | SP-360–362 | #47 |
| 005 | SP-541 | auto-proof-task-1 | Manifest bug #1 (placeholder — hydrate from SP-538) | S | SP-538 | TBD |
| 006 | SP-542 | auto-proof-task-2 | Manifest bug #2 | S | SP-538 | TBD |
| 007 | SP-543 | auto-proof-task-3 | Manifest bug #3 | S | SP-538 | TBD |
| 008 | SP-544 | auto-proof-doc-task | Manifest documentation task | S | SP-538 | TBD |
| 009 | SP-545 | auto-proof-enhancement | Manifest enhancement task | S | SP-538 | TBD |
| 010 | SP-546 | auto-postmortem-template | Automated post-mortem section in proof runbook | S | SP-539 | — |
| 011 | SP-547 | auto-context-phase62 | CONTEXT Phase 62 + proof sign-off in CONTEXT | S | leaves | — |

**Note:** SP-541–545 are **placeholders** until SP-538 manifest is operator-approved. `create-spine-tasks` hydrates PROMPT.md from manifest issue picks.

---

## 7. Proof execution flow

```text
Phase 0 — Manifest
  SP-538 (operator approves manifest)
  SP-539, SP-540 (checklists + gate script)

Phase 1 — Implement manifest tasks
  SP-541, SP-542, SP-543, SP-544, SP-545 (parallel waves per plan)
  SP-363 (runbook — may run wave 0)

Phase 2 — Proof batch (no product code)
  spine run sequence <manifest-scope> --auto-approve-gate --detached
  Operator: spine gate approve only (+ publish at end)

Phase 3 — Sign-off
  SP-546, SP-547
  Record open-issue count delta
  npm version minor (operator approval) → v2.0.0 tag
```

---

## 8. Gates-only exit criteria (definition of done)

- [ ] Operator started **one** autonomous or sequence-driven release session
- [ ] **Zero** manual `spine batch pause`, `retry`, or `resume --force` during waves
- [ ] Human actions limited to: `spine gate approve` (per wave) + explicit publish approval
- [ ] All manifest-scoped tasks `.DONE` on `main`
- [ ] `spine plan <manifest-scope>` shows 0 pending
- [ ] `npm run release:check` green before tag
- [ ] Open GitHub issues **decreased** vs proof start count
- [ ] Post-mortem committed: journal export + issue delta table
- [ ] `docs/release/automation-signoff-checklist.md` all boxes checked
- [ ] CONTEXT Phase 62 complete

---

## 9. Success metrics

| ID | Metric | Verification |
|----|--------|--------------|
| M-AUTO-01 | Gates-only execution | Operator attestation + journal shows no manual recovery events |
| M-AUTO-02 | Issue delta negative | `gh issue list --state open` before/after |
| M-AUTO-03 | release:check green | CI + local output |
| M-AUTO-04 | Manifest scope complete | `spine plan` empty for scope |

---

## 10. Wave run order

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 | SP-538, SP-539, SP-540 | Manifest + gates — **operator approval required** |
| 1 | SP-541, SP-542, SP-543 | Bugs — parallel if disjoint |
| 2 | SP-544, SP-545, SP-363 | Doc + enhancement |
| 3 | Proof sequence run | No new tasks — operator session |
| 4 | SP-546, SP-547 | Sign-off |

---

## 11. Workflow after this document

### 11.1 Author manifest (operator gate)

```text
Use create-spine-tasks to create SP-538 with Mission: write docs/release/manifest-v2.0.0-proof.md
from operator-selected issues. Operator must approve manifest before SP-541–545 authoring.
```

### 11.2 Hydrate proof tasks

```text
After manifest approval, create-spine-tasks decomposes SP-541–545 from manifest rows.
```

### 11.3 Execute proof

```bash
./scripts/release-proof-gate.sh
spine run sequence SP-541,SP-542,SP-543,SP-544,SP-545 --auto-approve-gate --detached
# Operator: spine gate approve between waves; npm version after sign-off
```

### 11.4 Post-proof

Update [`docs/release/stabilization-roadmap-v1.8-v2.0.md`](release/stabilization-roadmap-v1.8-v2.0.md) metrics table with actual issue counts. File follow-up epics for post-v2.0.0 backlog.

---

## 12. Related documents

| Document | Role |
|----------|------|
| [`docs/PRD-v2.0.md`](PRD-v2.0.md) | CDO feature spec (shipped — not this release) |
| [`docs/release/stabilization-roadmap-v1.8-v2.0.md`](release/stabilization-roadmap-v1.8-v2.0.md) | Master roadmap |
| [`skills/spine-release-operator/references/release-manifest-template.md`](../../skills/spine-release-operator/references/release-manifest-template.md) | Manifest format |
| [`docs/adoption/operator-runbook.md`](adoption/operator-runbook.md) | Recovery (should not be needed during proof) |
