# Release manifest — v2.6.0

**Created:** 2026-07-12
**Current version:** 2.5.0
**Target version:** v2.6.0
**Theme:** Consumer reliability + resume lifecycle — #197–#200 bugs; #160 Phase A
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-07-12)

**Source PRD:** [`docs/PRD-v2.6.0-consumer-resume-handoff.md`](../../../docs/PRD-v2.6.0-consumer-resume-handoff.md) (Phase 70 — SP-REL260)

Ceilings: skills/spine-release-operator/references/release-profiles.md

---

## Composition audit

| Bucket | Selected | Profile ceiling | Status |
|--------|----------|-----------------|--------|
| Documentation | 2 (runbook + CONTEXT) | ≤4 | PASS |
| Bug fixes | 4 issues (#197–#200) | ≤5 | PASS |
| Enhancements | 1 issue (#160 Phase A) | 1–2 | PASS |
| **Total tasks** | 8 (all S) | ≤15 | PASS |

**Profile audit:** PASS

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-635 | #197 | bug | S | Resume eligibility terminal class | Closes #197 |
| SP-636 | #198 | bug | S | Resume post-integrate finalize | Partial #198 |
| SP-637 | #198 | bug | S | Resume engine limbo diagnose | Closes #198 |
| SP-638 | #199 | bug | S | Evidence allow venv python | Closes #199 |
| SP-639 | #160 | enh | S | Evidence scripts/ executor | Partial #160 Phase A |
| SP-640 | #200 | bug | S | Lane commit ignore hook .venv | Closes #200 |
| SP-641 | — | doc | S | Runbook v2.6.0 | deps SP-635,637,638,640 |
| SP-642 | — | doc | S | CONTEXT Phase 70 capstone | deps SP-635–641 |

**Release scope ID:** `SP-635,SP-636,SP-637,SP-638,SP-639,SP-640,SP-641,SP-642`

---

## Gaps requiring new packets

All eight are new packets (lean create-spine-tasks).

---

## Deferred backlog

| Issue | Type | Rationale |
|-------|------|-----------|
| #160 Phase B/C | enh | Shell widening / review slot — not Phase A |
| #135 | enh | Dashboard DAG — M UX |
| #127 | enh | Mailbox steering |
| #124 | enh | Parallel wave strategies |
| #120 | enh | Journal integrity |
| #43 | epic | Monitoring toolkit |

---

## Wave plan snapshot

```text
Wave 0: SP-635, SP-636, SP-638, SP-640
Wave 1: SP-637, SP-639
Wave 2: SP-641
Cap: SP-642
```

**Launch:** `spine batch start pending` (operator-requested single pending start).

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run release:check` green
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke
