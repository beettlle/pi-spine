# Release manifest — v2.8.0

**Created:** 2026-07-13  
**Current version:** 2.7.0  
**Target version:** v2.8.0  
**Theme:** v2.7.0 dogfood land reliability (#205/#206/#207) — hygiene + bugs only  
**Bump type:** minor  
**Profile:** minor  
**Operator approved scope:** yes (2026-07-13 plan approval — 0 enhancements)

**Source:** [`docs/release/post-mortem-v2.7.0-batch-20260713T171709.md`](../../../docs/release/post-mortem-v2.7.0-batch-20260713T171709.md) §7 P0 (Phase 72 — SP-REL280)

Ceilings: skills/spine-release-operator/references/release-profiles.md

---

## Composition audit

| Bucket | Selected | Profile ceiling | Status |
|--------|----------|-----------------|--------|
| Documentation | 2 | ≤4 | PASS |
| Bug fixes | 5 | 3–5 | PASS |
| Enhancements | **0** | 1–2 allowed | PASS (operator override — hygiene + bugs only) |
| **Total tasks** | **7** | ≤15 | PASS |

**Profile audit:** PASS with operator override (enhancement slot waived)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-656 | #205 | bug | S | `.pi-smart-router` auto-clean markers | Partial #205 |
| SP-657 | #205 | bug | S | Post-DONE orphan auto-heal | Partial #205 |
| SP-658 | #205 | bug | S | Diagnose headline honesty | **Closes #205** |
| SP-659 | #206 | bug | S | `graphify-out` regenerate-after-clean | **Closes #206**; deps SP-656 |
| SP-660 | #207 | bug | S | Single resume owner | **Closes #207** |
| SP-661 | — | doc | S | Runbook v2.8.0 dogfood land | After code |
| SP-662 | — | doc | S | CONTEXT Phase 72 capstone | Capstone |

**Release scope ID:** `SP-656,SP-657,SP-658,SP-659,SP-660,SP-661,SP-662`

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #205 (3 slices) | bug | SP-656–658 | create-spine-tasks (lean) |
| #206 | bug | SP-659 | create-spine-tasks (lean) |
| #207 | bug | SP-660 | create-spine-tasks (lean) |
| Runbook / CONTEXT | doc | SP-661–662 | create-spine-tasks (lean) |

---

## Wave plan snapshot

```text
Spine plan — ids
7 task(s) · 4 wave(s) · maxParallel 4

Wave 0 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-656 — `.pi-smart-router` auto-clean markers
  Lane 2: SP-657 — Post-DONE orphan auto-heal
  Lane 3: SP-660 — Single resume owner

Wave 1 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-658 — Diagnose headline honesty
  Lane 2: SP-659 — `graphify-out` regenerate-after-clean race

Wave 2 · 1 task
  Lane 1: SP-661 — Runbook v2.8.0 dogfood land

Wave 3 · 1 task
  Lane 1: SP-662 — CONTEXT Phase 72 capstone
```

Expected sketch matched: Wave 0 SP-656/660/657 → Wave 1 SP-659/658 → Wave 2 SP-661 → Cap SP-662.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #160 Phase C | enh | `testing.review` slot — waived for v2.8.0 |
| #135 | enh | Dashboard DAG — out of dogfood-fix theme |
| #127 | enh | Mailbox steering — deferred |
| #124 | enh | Parallel wave strategies — deferred |
| #120 | enh | Journal integrity — deferred |
| #43 | epic | Monitoring toolkit — deferred |
| Stale worktrees cleanup | ops | Doctor one-liner; not an SP-* |

---

## Risks and blockers

- `src/batch/lane-dirty-check.mjs` (+ commit sibling) shared by SP-656 and SP-659 — serialized via deps
- SP-657/658 touch reconcile/diagnose — verify File Scope stays disjoint or serialize
- Docs-only Testing still runs full suite (hook churn) — acceptable for S docs; operators prefer detached + wait
- Never background `resume --attached` (#163)

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run release:check` green (typecheck, lint, tests, coverage — CI parity)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
