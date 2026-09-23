# Release manifest — v2.22.0

**Created:** 2026-09-21
**Current version:** 2.21.0
**Target version:** v2.22.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-09-21)
**Composition choice:** Standard A — MastodonML v2.21.0 incident cluster: DirtyWorktree / salvage land-loop / python3 evidence + peer bump to 0.87. Defer #285 Wave C (Actions majors), #283/#284 typing, P3/epics.
**Worker model pin:** `zai/glm-5.3-flash` via `agents.worker.model` / default profile — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**GitNexus:** refreshed 2026-09-21 — status up-to-date with HEAD (`c252519`)

---

## Context

Operator request: **next v2.22** after v2.21.0 → **v2.22.0** (minor).

- Current `main`: `2.21.0` @ `c252519`
- Pending SP-*: **0** (Next Task ID **SP-759**)
- Open issues: **18** — 0 `documentation`, 5 `bug` (#287–#292), rest `enhancement` / epics
- Dep drift: `pi-coding-agent` 0.85.1→**0.87.0** (≥1 0.x minor); `npm audit` **0 high/critical**

Intake snapshot: `spine-tasks/_authoring/release-v2.22.0/intake-snapshot-20260921.md`

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 | 2–4 (minor) | PASS |
| Bug fixes | 5 | 3–5 | PASS |
| Enhancements | 2 | 1–2 (minor) | PASS |
| **Total tasks** | 9 | 10–15 | PASS |

**Profile audit:** PASS

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@earendil-works/pi-coding-agent` 0.85.1→**0.87.0**; `typescript` 6.0.3→7.0.2 (defer); `eslint` 10.10.0→10.11.0 (patch — defer); `typebox` 1.3.30→1.3.34 (defer); `@types/node` 22.x→26 (defer) |
| `npm audit` highs/criticals | **0** |
| Action | **include** SP-767 (peer → ^0.87.0); **defer** #285 Wave C Actions majors, TypeScript 7, `@types/node` 26 |

### Deps mini-table

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| @earendil-works/pi-coding-agent | 0.85.1 | 0.87.0 | **include** SP-767 |
| typescript | 6.0.3 | 7.0.2 | **defer** (stay 6.x) |
| eslint | 10.10.0 | 10.11.0 | **defer** (same major) |
| typebox | 1.3.30 | 1.3.34 | **defer** |
| @types/node | 22.19.19 | 26.6.2 | **defer** (stay 22.x) |
| Actions checkout/setup-node/upload-artifact | v4 | v7 | **defer** (#285 Wave C) |

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #288 | bug | SP-759 (gap) | bug | **Select** — DirtyWorktree suggestedCommand |
| #290 | bug | SP-760 (gap) | bug | **Select** — python3 evidence allowlist |
| #287 | bug | SP-761 (gap) | bug | **Select** — journal rebuild laneNumber |
| #291 | bug | SP-762 (gap) | bug | **Select** — post-DONE plan_review_spawn_failed class |
| #292 | bug | SP-763 (gap) | bug | **Select** — salvage integrate → complete |
| #289 | enhancement | SP-764 (gap) | enh | **Select** — preflight tracked+gitignored warn |
| (docs) | — | SP-765 (gap) | doc | **Select** — DirtyWorktree / tracked-ignore docs |
| (docs) | — | SP-766 (gap) | doc | **Select** — salvage→complete land-loop docs |
| peer drift | hygiene | SP-767 (gap) | enh | **Select** — pi-coding-agent ^0.87.0 |
| #285 Wave C | enhancement P1 | — | enh | **Defer** — Actions majors |
| #283 / #284 | enhancement P2 | — | enh | **Defer** — typing Phase 2–3 |
| #225 / #231 / #43 | epic / P3 | — | epic | **Defer** |
| #212, #211, #209, #135, #127, #124 | P3 | — | enh | **Defer** |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-759 | #288 | bug | S | DirtyWorktree suggestedCommand from actual dirty paths | **Closes #288** |
| SP-760 | #290 | bug | S | Allow `python3` in gate evidence executables | **Closes #290** |
| SP-761 | #287 | bug | M | Preserve `task.laneNumber` on journal rebuild after DirtyWorktree retry | **Closes #287** |
| SP-762 | #291 | bug | M | Post-DONE `plan_review_spawn_failed` → salvageable, not forced retry | **Closes #291** |
| SP-763 | #292 | bug | S | After `salvage --integrate`, allow `batch complete` | **Closes #292**; soft-deps SP-762 |
| SP-764 | #289 | enh | S | Preflight/doctor warn when gitignored paths are still tracked | **Closes #289** |
| SP-765 | #288/#289 | doc | S | Document DirtyWorktree + tracked-ignore landmine | docs after SP-759/SP-764 |
| SP-766 | #291/#292 | doc | S | Document salvage→complete land loop after post-DONE review fail | docs after SP-762/SP-763 |
| SP-767 | peer | enh | S | Bump `@earendil-works/pi-coding-agent` to `^0.87.0` | dep hygiene; comment on #285 |

**Release scope ID:** `SP-759,SP-760,SP-761,SP-762,SP-763,SP-764,SP-765,SP-766,SP-767`

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #288 | bug | SP-759 | create-spine-tasks (lean) |
| #290 | bug | SP-760 | create-spine-tasks (lean) |
| #287 | bug | SP-761 | create-spine-tasks (lean) |
| #291 | bug | SP-762 | create-spine-tasks (lean) |
| #292 | bug | SP-763 | create-spine-tasks (lean); deps SP-762 |
| #289 | enh | SP-764 | create-spine-tasks (lean) |
| DirtyWorktree docs | doc | SP-765 | create-spine-tasks (lean); deps SP-759,SP-764 |
| Salvage land-loop docs | doc | SP-766 | create-spine-tasks (lean); deps SP-762,SP-763 |
| Peer 0.87 | enh | SP-767 | create-spine-tasks (lean) |

---

## Wave plan snapshot

```text
Spine plan — ids
9 task(s) · 3 wave(s) · maxParallel 4

Wave 0 · 6 tasks · 2 rounds (queued by maxParallel)
  Round 1 (4 parallel):
    Lane 1: SP-759 — DirtyWorktree suggestedCommand from actual dirty paths
    Lane 2: SP-760 — Allow bare python3 in gate evidence executables
    Lane 3: SP-761 — Preserve task.laneNumber on journal rebuild after DirtyWorktree retry
    Lane 4: SP-762 — Post-DONE plan_review_spawn_failed classification
  Round 2 (2 parallel):
    Lane 1: SP-764 — Preflight/doctor warn when gitignored paths are still tracked
    Lane 2: SP-767 — Bump pi-coding-agent peer to ^0.87.0

Wave 1 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-763 — After salvage --integrate, allow batch complete
  Lane 2: SP-765 — Document DirtyWorktree + tracked-ignore landmine

Wave 2 · 1 task
  Lane 1: SP-766 — Document salvage→complete land loop after post-DONE review fail
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #285 Wave C | enh | Actions majors; enh slots used by #289 + peer 0.87 |
| #283 / #284 | enh | Typing Phase 2–3 — large; not incident theme |
| #225 / #231 | epic | Matrix epic remainder |
| #212, #211, #209, #135, #127, #124, #43 | enh/epic | P3 / out of theme |
| typescript 7 / @types/node 26 | toolchain | Major — defer |

---

## Risks and blockers

- SP-761 / SP-762 may touch journal rebuild / reconcile / diagnosis — serialize if File Scope overlaps
- SP-763 depends on failure-class semantics from SP-762 — keep dependency edge
- Hygiene: `AGENTS.md` / `CLAUDE.md` dirty from GitNexus analyze (symbol counts) — commit before Phase 4 preflight

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main`
- [x] Post-integrate `release:check` green after each wave (logs under /tmp/pi-spine-post-integrate-*.log)
- [x] `spine preflight` green
- [x] `npm run release:check` green on final HEAD (2651 pass, coverage 89.63%; /tmp/pi-spine-post-integrate-docs-766.log)
- [ ] CI workflow green on HEAD — in_progress at Phase 5 stop (await success before tag)
- [x] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
- [x] Every release-scoped Closes CLOSED (#287–#292); #285 left OPEN (Wave C deferred)

---

## Phase 5 status

**Stopped for publish approval:** 2026-09-22
**HEAD:** `7734d3b7` (package.json still **2.21.0**)
**Release scope:** SP-759–SP-767 all `.DONE` on main; pending backlog 0
**Issues CLOSED:** #287 #288 #289 #290 #291 #292
**Deferred open:** #285 (Actions Wave C)
**Publish blocked until:** operator says approve publish + CI green on HEAD

