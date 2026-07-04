# Release manifest — v1.6.0

**Created:** 2026-07-04
**Current version:** 1.5.0
**Target version:** v1.6.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-07-04 — implement plan; isolated integrate anchor)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 4 | 2–4 | PASS |
| Bug fixes | 5 | 3–5 | PASS |
| Enhancements | 4 (1 epic split) | 1–2 | PASS with operator override |
| **Total tasks** | 13 | 10–15 | PASS |

**Profile audit:** PASS with operator override (integrate epic SP-474→477 counts as one enhancement anchor)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-438 | #78/#80 partial | doc | S | Flutter worktree adoption docs | Partial |
| SP-454 | #98 partial | doc | S | Orchestrator process model docs | Partial |
| SP-466 | #90 partial | doc | S | Spine orchestrate skill package | Partial |
| SP-467 | #90 | doc | S | Spine orchestrate slash command | Closes with SP-466 |
| SP-483 | #130 | bug | S | Post-merge sync restore safety | Closes |
| SP-441 | #94 | bug | S | Batch complete stale batch-state fix | Closes |
| SP-463 | #113 | bug | S | Graphify-out dirty check exclusion | Closes |
| SP-462 | #105 | bug | S | Contract scope base satisfied | Closes |
| SP-460 | #97 | bug | M | Doctor inherit provider auth probe | Closes |
| SP-474 | — | enh | S | Integrate base branch snapshot | #91 prereq |
| SP-475 | #91 partial | enh | M | Integrate isolated merge path | Partial |
| SP-476 | #91 partial | enh | S | Integrate config and doctor warnings | Partial |
| SP-477 | #91 | enh | S | Integrate sync-base CLI and diagnoses | Closes with SP-475/476 |

**Release scope ID:** `SP-438,SP-454,SP-466,SP-467,SP-483,SP-441,SP-463,SP-462,SP-460,SP-474,SP-475,SP-476,SP-477`

---

## Gaps requiring new packets

None — all selected work has existing SP-* packets.

---

## Wave plan snapshot

```text
Spine plan — ids
13 task(s) · 4 wave(s) · maxParallel 4

Wave 0 · 9 tasks · 2 rounds (queued by maxParallel)
  Round 1 (4 parallel):
    Lane 1 (serial): SP-438 → SP-454
    Lane 2 (serial): SP-441 → SP-474
    Lane 3: SP-460
    Lane 4: SP-462
  Round 2 (3 parallel):
    Lane 1: SP-463
    Lane 2: SP-466
    Lane 3: SP-483

Wave 1 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-467
  Lane 2: SP-475

Wave 2 · 1 task
  Lane 1: SP-476

Wave 3 · 1 task
  Lane 1: SP-477
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| SP-440/444 | enh | Supervisor MVP — operator chose integrate over supervisor |
| SP-452/455/453/456 | enh | Orchestrator perf/dashboard — out of budget |
| SP-432 | enh | Import cycle guard (#83) — arch refactor |
| SP-478 | bug | Contract verify resume (M) — out of budget |
| #117 | epic | v2.3 module split — out of minor scope |
| #141–150 | skill | create-spine-tasks cluster — skill authoring, not product release |
| Remaining pending | mixed | 13 tasks outside release scope |

---

## Risks and blockers

- SP-475/460 are M-sized — dedicated lanes; stallTimeoutMinutes ≥120
- Integrate chain serial: SP-474→475→476→477
- Preflight pre-landed contract risk: SP-462, SP-463 paths may need PROMPT amend if contract loops
- tasks analyze: SP-438/454 and SP-441/474 file-scope overlap — plan serializes on lanes

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` green
- [ ] `npm run coverage:check` green (≥77%)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
