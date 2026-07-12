# Release manifest — v2.4.0

**Created:** 2026-07-11
**Current version:** 2.3.2
**Target version:** v2.4.0
**Theme:** Recovery continuity — persist batch-meta for force-resume after abort (#126); finish deferred LOC splits SP-602/SP-605
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-07-11)

**Source PRD:** [`docs/PRD-v2.4.0-recovery-batch-meta-handoff.md`](../../../docs/PRD-v2.4.0-recovery-batch-meta-handoff.md) (Phase 68 — SP-REL240)

Ceilings: [release-profiles.md](../../../skills/spine-release-operator/references/release-profiles.md).

---

## Composition audit

Count **issues** for bug/enh rows (not split SP-*). Compare to **ceilings** (no bug floor).

| Bucket | Selected | Profile ceiling | Status |
|--------|----------|-----------------|--------|
| Documentation | 2 (runbook + CONTEXT) | ≤4 | PASS |
| Bug fixes | 0 issues | ≤5 | PASS |
| Enhancements | 1 issue (#126) | 1 | PASS |
| Refactor passengers | 2 (SP-602, SP-605) | within total | PASS |
| **Total tasks** | 6 | ≤15 | PASS |

**Profile audit:** PASS

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes (risk / changelog) |
|-------|-------|--------|------|-------|--------------------------|
| SP-602 | #117 | refactor | S | Extract journal-rebuild-drift | risk: S; leftover split; internal |
| SP-605 | #117 | refactor | S | Extract salvage-batch-integrate | risk: S; leftover split; internal |
| SP-619 | #126 | enh | S | Persist batch-meta.json | risk: S; Partial #126; changelog: survival topology artifact |
| SP-620 | #126 | enh | S | Reconstruct on force-resume | risk: M; Closes #126; changelog: resume after abort limbo |
| SP-621 | — | doc | S | Runbook batch-meta recovery | risk: S; deps SP-620 |
| SP-622 | — | doc | S | CONTEXT Phase 68 capstone | risk: S; deps SP-602,605,619–621 |

**Release scope ID:** `SP-602,SP-605,SP-619,SP-620,SP-621,SP-622`

---

## GitHub issue intake (2026-07-11)

### In release scope

| Issue | Priority | Action | Task |
|-------|----------|--------|------|
| #126 | enh | Implement (2 FRs) | SP-619–620 |
| SP-602, SP-605 | refactor | Execute existing packets | SP-602, SP-605 |

### Deferred (not added to v2.4.0)

| Issue | Type | Rationale |
|-------|------|-----------|
| #160, #135, #127–#120, #124–#121, #43 | enh/epic | Minor allows 1 enh; theme is #126 only |

---

## Wave plan snapshot

```text
Spine plan — ids
6 task(s) · 4 wave(s) · maxParallel 4

Wave 0 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-602 — Extract journal-rebuild-drift.mjs
  Lane 2: SP-605 — Extract salvage-batch-integrate.mjs
  Lane 3: SP-619 — Persist batch-meta.json

Wave 1 · 1 task
  Lane 1: SP-620 — Reconstruct batch state from batch-meta

Wave 2 · 1 task
  Lane 1: SP-621 — Runbook batch-meta recovery

Wave 3 · 1 task
  Lane 1: SP-622 — CONTEXT Phase 68 capstone
```

**Validate:** `Validated 6 task(s): 6 passed, 0 failed` (2026-07-11)  
**Analyze:** 0 blocking; 1 unrelated warning (missing historical `_explore/engine-lanes-split/findings.md` CONTEXT ref)

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-602 SP-605 SP-619 SP-620 SP-621 SP-622
spine plan SP-602,SP-605,SP-619,SP-620,SP-621,SP-622
spine run sequence SP-602,SP-605,SP-619,SP-620,SP-621,SP-622 --dry-run
spine run sequence SP-602,SP-605,SP-619,SP-620,SP-621,SP-622
```

**Regression gate** (after each integrate):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

**Operator gates:**

1. Approve this manifest — **done** (2026-07-11 plan approval)
2. Detached batches only (#163 / #185)
3. Publish only after Phase 5 `release:check` exit 0 + explicit `npm version minor` approval

---

## Deferred backlog (next release)

- #160 stet gate evidence
- #135 dashboard DAG
- #127–#120 / #124–#121 gate maturity / mailbox / strategies
- #43 monitoring epic
