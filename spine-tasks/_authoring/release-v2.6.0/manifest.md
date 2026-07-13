# Release manifest — v2.6.0

**Created:** 2026-07-12
**Updated:** 2026-07-13 (dogfood expansion)
**Current version:** 2.5.0
**Target version:** v2.6.0
**Theme:** Consumer reliability + resume lifecycle — #197–#200; #160 Phase A; dogfood #201/#203/#204; PI_SPINE_ROOT ergonomics (SP-643)
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-07-12); **re-approve** for dogfood expansion (bug budget override)

**Source PRD:** [`docs/PRD-v2.6.0-consumer-resume-handoff.md`](../../../docs/PRD-v2.6.0-consumer-resume-handoff.md) (Phase 70 — SP-REL260)

Ceilings: skills/spine-release-operator/references/release-profiles.md

---

## Composition audit

| Bucket | Selected | Profile ceiling | Status |
|--------|----------|-----------------|--------|
| Documentation | 2 (runbook + CONTEXT) | ≤4 | PASS |
| Bug fixes | 8 issue-tracks (#197–#201, #203–#204 + SP-643 ergonomics) | ≤5 | **PASS with operator override** |
| Enhancements | 1 (#160 Phase A) | 1–2 | PASS |
| **Total tasks** | 14 (SP-635–648; all S) | ≤15 | PASS |

**Profile audit:** PASS with operator override (bug bucket expanded for dogfood blockers)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-635 | #197 | bug | S | Resume eligibility terminal class | Code on main — hygiene `.DONE` |
| SP-636 | #198 | bug | S | Resume post-integrate finalize | Partial #198; hygiene `.DONE` |
| SP-637 | #198 | bug | S | Resume engine limbo diagnose | Closes #198 with SP-636 |
| SP-638 | #199 | bug | S | Evidence allow venv python | Hygiene `.DONE` |
| SP-639 | #160 | enh | S | Evidence scripts executor | Partial #160 Phase A |
| SP-640 | #200 | bug | S | Lane commit ignore hook .venv | Hygiene `.DONE` |
| SP-641 | — | doc | S | Runbook v2.6.0 | deps include SP-645/647/648 |
| SP-642 | — | doc | S | CONTEXT Phase 70 capstone | deps SP-635–648 |
| SP-643 | ergonomics | bug | S | CLI default PI_SPINE_ROOT cwd | `.DONE`; does **not** close #203 |
| SP-644 | #201 | bug | S | Complete refuse pending lane land | Partial #201 |
| SP-645 | #201 | bug | S | Diagnose salvage pending lane | Closes #201 |
| SP-646 | #203 | bug | S | Dead engine orphan classify | Partial #203 |
| SP-647 | #203 | bug | S | Orphan retry/abort limbo clear | Closes #203 |
| SP-648 | #204 | bug | S | PATH spine version skew warn | Closes #204 |

**Release scope ID:** `SP-635,SP-636,SP-637,SP-638,SP-639,SP-640,SP-641,SP-642,SP-643,SP-644,SP-645,SP-646,SP-647,SP-648`

---

## Gaps requiring new packets

SP-644–648 authored 2026-07-13 (lean create-spine-tasks; maximal two-deliverable splits for #201/#203).

---

## Deferred backlog

| Issue | Type | Rationale |
|-------|------|-----------|
| #202 | bug | Wrong-cwd plan message — UX; defer to v2.6.1 |
| #160 Phase B/C | enh | Shell widening / review slot — not Phase A |
| #135 | enh | Dashboard DAG — M UX |
| #127 | enh | Mailbox steering |
| #124 | enh | Parallel wave strategies |
| #120 | enh | Journal integrity |
| #43 | epic | Monitoring toolkit |

---

## Wave plan snapshot

```text
Wave H: SP-635, SP-636, SP-638, SP-640 hygiene .DONE only (no re-impl)
Wave 0: SP-644, SP-646, SP-648   (disjoint: lifecycle / orphan / doctor)
Wave 1: SP-645, SP-647           (deps SP-644 / SP-646)
Wave 2: SP-637, SP-639
Wave 3: SP-641
Cap: SP-642
```

**CLI:** prefer `node bin/spine.mjs` (PATH global may be 2.4.0 vs checkout 2.5.0 — #204).

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main` (working tree; commit pending)
- [x] `npm run release:check` green (2140 pass, coverage 89.13%)
- [ ] `git status` clean / commits pushed
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke
