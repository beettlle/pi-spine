# Release manifest — v2.7.0

**Created:** 2026-07-13  
**Current version:** 2.6.0  
**Target version:** v2.7.0  
**Theme:** Operator cwd UX + evidence Phase B (narrow) + doctor/template hygiene  
**Bump type:** minor  
**Profile:** minor  
**Operator approved scope:** yes (2026-07-13 plan approval)

**Source PRD:** [`docs/PRD-v2.7.0-operator-ux-evidence-handoff.md`](../../../docs/PRD-v2.7.0-operator-ux-evidence-handoff.md) (Phase 71 — SP-REL270)

Ceilings: skills/spine-release-operator/references/release-profiles.md

---

## Composition audit

| Bucket | Selected | Profile ceiling | Status |
|--------|----------|-----------------|--------|
| Documentation | 2 (runbook + CONTEXT) | ≤4 | PASS |
| Bug fixes | 4 (#202 ×2, template drift, `.gitignore`) | ≤5 | PASS |
| Enhancements | 1 (#160 Phase B narrow) | 1–2 | PASS |
| **Total tasks** | 7 (SP-649–655; all S) | ≤15 | PASS |

**Profile audit:** PASS

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-649 | #202 | bug | S | Wrong-cwd config missing message | Partial #202 |
| SP-650 | #202 | bug | S | Wrong-cwd CLI surfaces | **Closes #202** |
| SP-651 | — | bug | S | Template evidence command drift | Phase-A-safe template |
| SP-652 | — | bug | S | Gitignore `.pi/` entry | Doctor hygiene |
| SP-653 | #160 | enh | S | Evidence allowlisted npm chains | Partial #160 Phase B |
| SP-654 | — | doc | S | Runbook v2.7.0 operator UX | deps code tasks |
| SP-655 | — | doc | S | CONTEXT Phase 71 capstone | deps SP-649–654 |

**Release scope ID:** `SP-649,SP-650,SP-651,SP-652,SP-653,SP-654,SP-655`

---

## Gaps requiring new packets

All SP-649–655 authored 2026-07-13 (lean create-spine-tasks).

---

## Deferred backlog

| Issue | Type | Rationale |
|-------|------|-----------|
| #160 Phase C | enh | `testing.review` slot |
| #135 | enh | Dashboard DAG — M UX |
| #127 | enh | Mailbox steering |
| #124 | enh | Parallel wave strategies |
| #120 | enh | Journal integrity |
| #43 | epic | Monitoring toolkit |

---

## Wave plan snapshot

```text
Wave 0: SP-649, SP-651, SP-652
Wave 1: SP-650 (deps SP-649), SP-653
Wave 2: SP-654
Cap: SP-655
```

**Operator gates:**

1. Approve this manifest — **done** (2026-07-13 plan approval)
2. Detached batches only (#163 / #185)
3. Publish only after `release:check` exit 0 + explicit `npm version minor` approval

---

## Launch commands

```bash
./bin/spine.mjs tasks validate SP-649,SP-650,SP-651,SP-652,SP-653,SP-654,SP-655
./bin/spine.mjs tasks analyze SP-649,SP-650,SP-651,SP-652,SP-653,SP-654,SP-655
./bin/spine.mjs plan SP-649,SP-650,SP-651,SP-652,SP-653,SP-654,SP-655
# Detached only:
./bin/spine.mjs batch start SP-649,SP-650,SP-651,SP-652,SP-653,SP-654,SP-655 --wave 0
```
