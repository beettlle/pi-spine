# Release manifest — v1.7.0

**Created:** 2026-07-05
**Current version:** 1.6.0
**Target version:** v1.7.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** no

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 | 2–4 | PASS |
| Bug fixes | 5 | 3–5 | PASS |
| Enhancements | 2 | 1–2 | PASS |
| **Total tasks** | 11 | 10–15 | PASS |

**Profile audit:** PASS

**Theme:** FR-SHIP-11 supervisor MVP (#71), Flutter/contract reliability (#78/#80/#105), import-cycle hardening (#83 partial).

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-444 | #71 | doc | S | Supervisor config doctor and docs | Closes #71 with SP-440 |
| SP-497 | #168 | doc | S | Release operator skill state_drift docs | Gap — author in Phase 3 |
| SP-458 | #78 | bug | M | Flutter lane analyzer hygiene | Closes |
| SP-459 | #80 | bug | S | Gitignored asset worktree hook | Closes |
| SP-478 | #105 | bug | M | Contract verify resume baseline | Partial |
| SP-479 | #105 | bug | S | Contract CLI friction fixes | Partial; after SP-478 |
| SP-468 | #83 | bug | S | Resume validation leaf | Slice B |
| SP-469 | #83 | bug | S | Detached spawn leaf | Slice C; after SP-468 |
| SP-440 | #71 | enh | M | Supervisor spawn MVP | Partial #71 |
| SP-452 | #98 | enh | S | Orchestrator poll interval defaults | Partial #98 |
| SP-432 | #83 | enh | S | Import cycle arch guard | Closes #83; after SP-469 |

**Release scope ID:** `SP-440,SP-444,SP-452,SP-458,SP-459,SP-468,SP-469,SP-478,SP-479,SP-432,SP-497`

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #168 | doc | SP-497 | create-spine-tasks (lean) — docs-only remainder after SP-496 |

---

## Wave plan snapshot

```text
Spine plan — ids (10 existing tasks; SP-497 docs-only, wave 1 after SP-496 pattern)
10 task(s) · 3 wave(s) · maxParallel 4

Wave 0 · serial · 6 tasks (overlapping file scope)
  Lane 1: SP-440 — Supervisor spawn MVP
  Lane 2 (serial): SP-452 → SP-459
  Lane 3 (serial): SP-458 → SP-478
  Lane 4: SP-468 — Resume validation leaf

Wave 1 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-444 — Supervisor config doctor and docs
  Lane 2: SP-469 — Detached spawn leaf
  Lane 3: SP-479 — Contract CLI friction fixes

Wave 2 · 1 task
  Lane 1: SP-432 — Import cycle arch guard

Wave 1b (after wave 1 lands): SP-497 — Release operator skill #168 docs (S, docs-only)
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| SP-453, SP-455, SP-456 | enh | Orchestrator perf/dashboard cluster — out of v1.7.0 budget |
| #163 | bug P1 | Attached batch SIGKILL/orphan — no packet yet; follow-on patch |
| #165, #166, #167 | bug P2 | v1.6.0 drift recovery follow-ups — no packets yet |
| #169 | enh | Worktree auto-cleanup on abort/dismiss — no packet yet |
| #156 | enh P1 | Release-safe CI pre-tag gate — separate release infra |
| #141–150 | skill | create-spine-tasks cluster — skill authoring, not product release |
| #117 | epic | v2.3 module split — out of minor scope |
| #71 Tier 2 | enh | Dashboard supervisor surfaces — after MVP lands |

---

## Risks and blockers

- Git tree dirty (`.spine/rules-manifest.json`, deleted `release-v1.6.0/plan.md`) — stash/commit before batch start
- SP-458/SP-478 share contract-verify hot path — plan serializes on lane 3
- SP-440 (M) supervisor spawn — dedicated lane; `stallTimeoutMinutes ≥120`
- SP-432 depends on SP-469 chain — wave 2 only after wave 1 lands
- `tasks analyze pending` reports file-scope overlap SP-452/SP-459 and SP-458/SP-478 — plan already serializes
- SP-497 gap must be authored before wave 1b (docs-only, low risk)

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run release:check` green (typecheck, lint, tests, coverage — CI parity)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
