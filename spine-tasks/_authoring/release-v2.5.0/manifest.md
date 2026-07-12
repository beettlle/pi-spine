# Release manifest — v2.5.0

**Created:** 2026-07-12
**Current version:** 2.4.0
**Target version:** v2.5.0
**Theme:** Gate maturity — targetRevision (#121), structured blockers (#122), category postures (#123)
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-07-12)

**Source PRD:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../../docs/PRD-v2.5.0-gate-maturity-handoff.md) (Phase 69 — SP-REL250)

Ceilings: [release-profiles.md](../../../skills/spine-release-operator/references/release-profiles.md).

---

## Composition audit

Count **issues** for bug/enh rows (not split SP-*). Compare to **ceilings** (no bug floor).

| Bucket | Selected | Profile ceiling | Status |
|--------|----------|-----------------|--------|
| Documentation | 2 (runbook + CONTEXT) | ≤4 | PASS |
| Bug fixes | 0 issues | ≤5 | PASS |
| Enhancements | 3 issues (#121, #122, #123) | 1–2 | **OVERRIDE** (operator asked to include #123) |
| **Total tasks** | 12 (all S) | ≤15 | PASS |

**Profile audit:** PASS with operator override (enhancement count 3 > 2)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes (risk / changelog) |
|-------|-------|--------|------|-------|--------------------------|
| SP-623 | #121 | enh | S | Persist targetRevision | Partial #121 |
| SP-624 | #121 | enh | S | Validate targetRevision on use | Closes #121 |
| SP-625 | #122 | enh | S | BlockerCode types module | Partial #122 |
| SP-626 | #122 | enh | S | Wire structured blockers | Closes #122 |
| SP-627 | #123 | enh | S | DEFAULT_POSTURES | Partial #123 |
| SP-628 | #123 | enh | S | Posture evaluator cascade | Partial #123 |
| SP-629 | #123 | enh | S | Posture config load | Partial #123 |
| SP-630 | #123 | enh | S | Stamp category on gate open | Partial #123 |
| SP-631 | #123 | enh | S | Approval streak counters | Partial #123 |
| SP-632 | #123 | enh | S | Wire evaluator to approve | Closes #123 |
| SP-633 | — | doc | S | Runbook gate maturity | deps SP-624,626,632 |
| SP-634 | — | doc | S | CONTEXT Phase 69 capstone | deps SP-623–633 |

**Release scope ID:** `SP-623,SP-624,SP-625,SP-626,SP-627,SP-628,SP-629,SP-630,SP-631,SP-632,SP-633,SP-634`

---

## Gaps requiring new packets

All twelve are new packets (lean create-spine-tasks).

---

## GitHub issue intake (2026-07-12)

### In release scope

| Issue | Priority | Action | Task |
|-------|----------|--------|------|
| #121 | enh | Implement (2×S) | SP-623–624 |
| #122 | enh | Implement (2×S) | SP-625–626 |
| #123 | enh | Implement (6×S; was M) | SP-627–632 |

### Deferred (not added to v2.5.0)

| Issue | Type | Rationale |
|-------|------|-----------|
| #160 | enh P3 | Stet gate evidence — not this theme |
| #135 | enh | Dashboard DAG — M UX |
| #127 | enh | Mailbox steering |
| #124 | enh | Parallel wave strategies |
| #120 | enh | Journal integrity |
| #43 | epic | Monitoring toolkit |

---

## Wave plan snapshot

```text
Spine plan — ids
12 task(s) · 7 wave(s) · maxParallel 4

Wave 0 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-623 — Persist targetRevision on gate open
  Lane 2: SP-625 — BlockerCode types module
  Lane 3: SP-627 — DEFAULT_POSTURES categories table

Wave 1 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-624 — Validate targetRevision on gate use
  Lane 2: SP-628 — Pure posture evaluation cascade
  Lane 3: SP-629 — Load gate postures from spine-config

Wave 2 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-626 — Wire structured blockers into gate checks
  Lane 2: SP-631 — Approval streak counters for after-N

Wave 3 · 1 task
  Lane 1: SP-630 — Stamp category on gate open

Wave 4 · 1 task
  Lane 1: SP-632 — Wire posture evaluator into approve path

Wave 5 · 1 task
  Lane 1: SP-633 — Runbook gate maturity

Wave 6 · 1 task
  Lane 1: SP-634 — CONTEXT Phase 69 capstone
```

**Validate:** `Validated 12 task(s): 12 passed, 0 failed` (2026-07-12)  
**Analyze:** 0 blocking; 1 unrelated warning (missing historical `_explore/engine-lanes-split/findings.md`)  
**Note:** SP-630 depends on SP-626 to serialize `gate.mjs` edits.
---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-623 SP-624 SP-625 SP-626 SP-627 SP-628 SP-629 SP-630 SP-631 SP-632 SP-633 SP-634
spine plan SP-623,SP-624,SP-625,SP-626,SP-627,SP-628,SP-629,SP-630,SP-631,SP-632,SP-633,SP-634
spine run sequence SP-623,SP-624,SP-625,SP-626,SP-627,SP-628,SP-629,SP-630,SP-631,SP-632,SP-633,SP-634 --dry-run
```

**Regression gate** (after each integrate):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

**Operator gates:**

1. Approve this manifest — **done** (2026-07-12 plan approval + #123 include)
2. Detached batches only (#163 / #185)
3. Publish only after Phase 5 `release:check` exit 0 + explicit `npm version minor` approval

---

## Deferred backlog (next release)

- #160 stet gate evidence
- #135 dashboard DAG
- #127 mailbox steering
- #124 parallel wave strategies
- #120 journal SHA-256
- #43 monitoring epic
