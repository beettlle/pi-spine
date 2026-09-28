# Release manifest — v2.25.0

**Created:** 2026-09-27
**Current version:** 2.24.0
**Target version:** v2.25.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-09-27 — scope enumerated in the operator invocation: P0 #296, #297, #298; P1 #308 first, then #300, #306, #303; budget override "even if this is more work than is normal for this type of release")
**Composition choice:** Brutal-audit 2026-09-27 remediation — all three P0s plus four P1 quick wins. #308 lands in wave 1 because its flake intermittently reds `npm test` / `release:check`.
**Worker model pin:** `zai/glm-5.3-flash` via `agents.worker.model` / default profile — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**GitNexus:** refreshed 2026-09-27 — status up-to-date with HEAD (`081f4296`)

---

## Context

Operator request: **next v2.25** after v2.24.0 → **v2.25.0** (minor).

- Current `main`: `2.24.0` @ `081f4296` (v2.24.0 tagged, on npm, GitHub Release 2026-09-27T05:48:36Z)
- Pending SP-*: **0** before authoring (Next Task ID was **SP-779**)
- Open issues: **38** — 0 `documentation`; 3 P0 bugs (#296–#298), 9 P1 bugs (#299–#308), P2/P3 backlog, epic #324
- Dep drift: toolchain majors only (`typescript` 6→7, `@types/node` 22→26); `npm audit` **0**
- `spine status --diagnose`: idle

### Authoring constraint — batch module LOC cap

`bin/spine-cli/verify.mjs` enforces `BATCH_MODULE_LOC_LIMIT = 500` on every top-level `src/batch/*.mjs` with an **empty** grandfather list. Near-cap targets: `integrate.mjs` 497, `contract-exec.mjs` 498, `worker-output.mjs` 492, `salvage-batch-integrate.mjs` 490, `reconcile-batch.mjs` 487, `journal.mjs` 463. Packets that touch these files say "extract, don't grow". `src/batch/engine-lanes/*` is not counted.

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 | 2–4 (minor) | WARN — 0 doc issues open; SP-789 documents the new recovery behaviors |
| Bug fixes | 7 issues / 10 packets | 3–5 | **PASS with operator override** (operator enumerated 7 bugs) |
| Enhancements | 0 | 1–2 (minor) | PASS with operator override (bug-only release by operator choice) |
| **Total tasks** | 11 | 10–15 | PASS |

**Profile audit:** PASS with operator override (bug count 7 > 5; 0 enhancements; docs under floor)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `typescript` 6.0.3 → 7.0.2 (major); `@types/node` 22.20.4 → 26.6.3 (major). No same-major drift. |
| `npm audit` highs/criticals | **0** |
| Action | **deferred** — toolchain majors fire the minor threshold, but the operator scoped this release to bug fixes only; TS 7 migration deserves its own release |

### Deps mini-table

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| typescript | 6.0.3 | 7.0.2 | **defer** (major; operator bug-only scope) |
| @types/node | 22.20.4 | 26.6.3 | **defer** (major) |

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #308 | bug P1 | SP-779 | bug | **Select** — wave 1 (unblocks `release:check`) |
| #296 | bug P0 | SP-780 | bug | **Select** |
| #297 | bug P0 | SP-781 (Partial), SP-783 (Closes) | bug | **Select** — split: runtime guard / shell limits |
| #298 | bug P0 | SP-782 (Partial), SP-784 (Closes) | bug | **Select** — split: base-ref CAS / checkout sync safety |
| #300 | bug P1 | SP-785 | bug | **Select** |
| #303 | bug P1 | SP-786 | bug | **Select** |
| #306 | bug P1 | SP-787 (Closes), SP-788 (Partial) | bug | **Select** — split: spawn hardening / engine crash journal |
| — | doc | SP-789 | doc | **Select** — runbook for new recovery behaviors |
| #299, #301, #302, #304, #305, #307 | bug P1 | — | bug | **Defer** — outside operator scope |
| #309–#323 | P2 | — | bug/enh | **Defer** |
| #324 | epic P1 | — | epic | **Defer** (tracking epic; this release advances it) |
| #293, #294 | bug (unprioritized) | — | bug | **Defer** |
| #225, #231, #212, #211, #209, #135, #127, #124, #43 | P3 | — | enh/epic | **Defer** |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-779 | #308 | bug | M | Stall watchdog observes worker exit before deadline | Closes #308 |
| SP-780 | #296 | bug | M | Journal tolerates torn lines | Closes #296 |
| SP-781 | #297 | bug | S | Matrix row runtime metachar guard | Partial #297 |
| SP-782 | #298 | bug | M | Integrate base-ref compare-and-swap | Partial #298 |
| SP-783 | #297 | bug | S | Matrix row shell timeout + output cap | Closes #297 |
| SP-784 | #298 | bug | M | Integrate checkout sync safety | Closes #298; deps SP-782 |
| SP-785 | #300 | bug | M | Unified task-ID discovery (SP-1000+) | Closes #300 |
| SP-786 | #303 | bug | M | Quarantine corrupt batch-state | Closes #303 |
| SP-787 | #306 | bug | M | Worker spawn hardening | Closes #306 (close after SP-788 lands too) |
| SP-788 | #306 | bug | S | Engine crash journaling | Partial #306 |
| SP-789 | — | doc | S | Runbook: v2.25.0 recovery-evidence hardening | deps SP-780, SP-783, SP-784, SP-786 |

**Release scope ID:** `SP-779,SP-780,SP-781,SP-782,SP-783,SP-784,SP-785,SP-786,SP-787,SP-788,SP-789`

### Operator wave plan (explicit scope per wave)

The planner would put every no-dependency task in wave 1. Waves run as explicit scope lists instead, to keep ≤4 M tasks per wave and land #308 first:

| Wave | Scope | Rationale |
|------|-------|-----------|
| 1 | `SP-779,SP-780,SP-781,SP-782` | #308 first + P0 cores |
| 2 | `SP-783,SP-784,SP-785,SP-786` | P0 follow-ups + #300, #303 |
| 3 | `SP-787,SP-788,SP-789` | #306 + docs |

---

## Gaps requiring new packets

All 11 packets are new (lean authoring). See Selected tasks.

---

## Wave plan snapshot

`spine tasks validate <scope>`: 11 passed, 0 failed. `spine tasks analyze <scope>`: 0 blocking, 2 warnings (whole-scope wave 0 has 6 M tasks — handled by explicit per-wave scopes below; pre-existing missing `_explore/engine-lanes-split/findings.md`).

```text
spine plan SP-779,SP-780,SP-781,SP-782
Wave 0 · 4 tasks · 4 lanes in parallel
  Lane 1: SP-779 — Stall watchdog observes worker exit before deadline
  Lane 2: SP-780 — Journal tolerates torn lines
  Lane 3: SP-781 — Matrix row runtime metachar guard
  Lane 4: SP-782 — Integrate base-ref compare-and-swap

spine plan SP-783,SP-784,SP-785,SP-786   (after wave 1 lands)
Wave 0 · 4 tasks · 4 lanes in parallel
  Lane 1: SP-783 — Matrix row shell timeout and output cap
  Lane 2: SP-784 — Integrate checkout sync safety
  Lane 3: SP-785 — Unified task-ID discovery (SP-1000+)
  Lane 4: SP-786 — Quarantine corrupt batch-state instead of deleting it

spine plan SP-787,SP-788,SP-789   (after wave 2 lands)
Wave 0 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-787 — Worker spawn hardening
  Lane 2: SP-788 — Engine crash journaling
  Lane 3: SP-789 — Runbook: v2.25.0 recovery-evidence hardening
```

Baseline `npm run release:check` on `081f4296` (pre-authoring): tests 2651 pass / 0 fail — log `/tmp/pi-spine-v2.25-baseline.log`.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #299, #301, #302, #304, #305, #307 | bug P1 | Outside operator-enumerated scope; next release candidates |
| #309–#323 | P2 | Defer |
| TypeScript 7 / `@types/node` 26 | dep major | Own release |
| #225 / #231 matrix epic | epic | #297 lands first as #297 asks |

---

## Risks and blockers

- 11 packets is above a normal minor; operator override recorded.
- Near-cap `src/batch/*` modules (see LOC constraint) — workers must extract helpers rather than grow files.
- #298 touches the land loop itself; wave 2 integrate (SP-784) runs with SP-782's CAS already on `main`.

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main`
- [x] Post-integrate `release:check` green after **each wave** — wave 1: 2672/2672 (`/tmp/pi-spine-post-integrate-wave-1.log`); wave 2: 2694/2694 (`/tmp/pi-spine-post-integrate-wave-2.log`); wave 3: 2709/2709, 89.97% lines (`/tmp/pi-spine-post-integrate-wave-3.log`)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD`
- [ ] CI green on `HEAD`
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded; staged package approved (2FA)
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
