# Release manifest — v2.3.2

**Created:** 2026-07-11
**Current version:** 2.3.1
**Target version:** v2.3.2
**Bump type:** patch
**Profile:** patch (state-drift recovery — 6 tasks; enhancement override for #193)
**Operator approved scope:** yes (2026-07-11)

**Source PRD:** [`docs/PRD-v2.3.2-state-drift-recovery-handoff.md`](../../../docs/PRD-v2.3.2-state-drift-recovery-handoff.md) (Phase 67 — SP-REL232)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 (runbook + skill DoR) | 1–2 | PASS |
| Bug fixes | 3 (#196 split) | 3–5 | PASS |
| Enhancements | 1 (#193 skill/docs) | 0 | **PASS with operator override** |
| **Total tasks** | 6 | 5–8 | PASS |

**Profile audit:** PASS with operator override (#193 in patch)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-613 | #196 | bug | S | drift detached recover | Partial |
| SP-614 | #196 | bug | S | salvage lane commits | Partial |
| SP-615 | #196 | bug | S | abort dry-run readonly | Closes #196 (deps 613–614) |
| SP-616 | #193 | enh/docs | S | create-spine-tasks DoR lanes | Closes #193 |
| SP-617 | — | doc | S | runbook agent drift recovery | deps SP-613 |
| SP-618 | — | doc | S | CONTEXT Phase 67 capstone | deps SP-613–617 |

**Release scope ID:** `SP-613,SP-614,SP-615,SP-616,SP-617,SP-618`

---

## GitHub issue intake (2026-07-11)

### In release scope

| Issue | Priority | Action | Task |
|-------|----------|--------|------|
| #196 | bug | Implement (3 FRs) | SP-613–615 |
| #193 | enh | Implement (docs/skill; override) | SP-616 |

### Deferred (not added to v2.3.2)

| Issue | Type | Rationale |
|-------|------|-----------|
| #160, #135, #127–#120, #124–#126, #43 | enh/epic | Patch backlog; only #193 overridden |
| SP-602, SP-605 | pending split | Leftover v2.3.0 LOC work; avoid salvage-file collision |

---

## Wave plan snapshot

```text
Spine plan — ids
6 task(s) · 3 wave(s) · maxParallel 4

Wave 0 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-613 — Drift detached recover
  Lane 2: SP-614 — Salvage lane commits
  Lane 3: SP-616 — Create-spine-tasks DoR lanes

Wave 1 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-615 — Abort dry-run readonly
  Lane 2: SP-617 — Runbook agent drift recovery

Wave 2 · 1 task
  Lane 1: SP-618 — CONTEXT Phase 67 capstone
```

**Validate:** `Validated 6 task(s): 6 passed, 0 failed` (2026-07-11)  
**Analyze:** 0 blocking; 1 unrelated warning (missing historical `_explore/engine-lanes-split/findings.md` CONTEXT ref)

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-613 SP-614 SP-615 SP-616 SP-617 SP-618
spine plan SP-613,SP-614,SP-615,SP-616,SP-617,SP-618
spine run sequence SP-613,SP-614,SP-615,SP-616,SP-617,SP-618 --dry-run
spine run sequence SP-613,SP-614,SP-615,SP-616,SP-617,SP-618
```

**Regression gate** (after each integrate):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

**Operator gates:**

1. Approve this manifest — **done** (2026-07-11)
2. Detached batches only (#163 / #185)
3. Publish only after Phase 5 `release:check` exit 0 + CI green on HEAD

---

## Deferred backlog (next minor)

- #160 stet gate evidence
- #135 dashboard DAG
- #127–#120 gate maturity / mailbox
- #124–#126 parallel strategies / force-resume meta
- #43 monitoring epic
- SP-602, SP-605 LOC leftovers
