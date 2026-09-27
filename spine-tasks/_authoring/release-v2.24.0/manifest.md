# Release manifest — v2.24.0

**Created:** 2026-09-26
**Current version:** 2.23.0
**Target version:** v2.24.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-09-26)
**Composition choice:** Option A — Close #284 (reconcile/doctor typing, #266 Phase 3) + same-major dependency hygiene. Defer TypeScript 7, `@types/node` 26, and P3/epics. Operator selected 2026-09-26.
**Worker model pin:** `zai/glm-5.3-flash` via `agents.worker.model` / default profile — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**GitNexus:** refreshed 2026-09-26 — status up-to-date with HEAD (`9942b782`)

---

## Context

Operator request: **next v2.24** after v2.23.0 → **v2.24.0** (minor).

- Current `main`: `2.23.0` @ `9942b782` (v2.23.0 tagged, published on npm, GitHub Release 2026-09-26T23:36:59Z)
- Pending SP-*: **0** before authoring (Next Task ID was **SP-774**)
- Open issues: **10** — 0 `documentation`, 0 `bug`, all `enhancement` / epics (#284 only P2)
- Dep drift: peer `0.87.0`→`0.87.1`, eslint `10.10`→`10.11`, typebox `1.3.30`→`1.3.34`, `@types/node` `22.19`→`22.20` (all same major); `npm audit` **0**
- `spine doctor`: all checks passed (advisories: quota-risk #251, 5 stale worktree dirs)

**Profile override:** bug floor 0 (no open bugs) — same override as v2.23.0.

### Typing probe (sizing evidence)

Throwaway worktree at `9942b782`: stripped `// @ts-nocheck` from the 8 #284 targets and added them to `tsconfig.batch.json`. `npx tsc --project tsconfig.batch.json --noEmit` error counts:

| Module | LOC | Errors |
|--------|-----|--------|
| `src/batch/reconcile-diagnosis.mjs` | 384 | 50 |
| `src/batch/reconcile-batch.mjs` | 492 | 43 |
| `src/batch/reconcile-classify.mjs` | 433 | 38 |
| `src/batch/reconcile-orphan.mjs` | 302 | 33 |
| `src/batch/reconcile-diagnosis-context.mjs` | 88 | 31 |
| `src/doctor/run-doctor-checks.mjs` | 597 | 16 |
| `src/batch/reconcile.mjs` | 41 | 0 |
| `src/batch/reconcile-light-cache.mjs` | 61 | 0 |

`reconcile-batch.mjs` is 492 lines against `BATCH_MODULE_LOC_LIMIT` 500 — inline casts only (no multi-line JSDoc blocks).

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 | 2–4 (minor) | WARN — thin intake (0 doc issues); SP-777 documents #284 |
| Bug fixes | 0 | 3–5 | **PASS with operator override** (no open bugs) |
| Enhancements | 2 | 1–2 (minor) | PASS (#284 typing + dep hygiene slot) |
| **Total tasks** | 5 | 10–15 | PASS (under floor OK for thin intake) |

**Profile audit:** PASS with operator override (bug count &lt; 3; docs under floor — no doc issues open)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@earendil-works/pi-coding-agent` 0.87.0→**0.87.1**; `eslint` 10.10.0→**10.11.0**; `typebox` 1.3.30→**1.3.34**; `@types/node` 22.19.19→**22.20.4** (wanted) / 26.6.3 (latest); `typescript` 6.0.3→7.0.2 |
| `npm audit` highs/criticals | **0** |
| Action | **include** same-major hygiene as SP-778 (operator choice A); **defer** TypeScript 7 and `@types/node` 26 (toolchain majors) |

### Deps mini-table

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| @earendil-works/pi-coding-agent | 0.87.0 | 0.87.1 | **include** SP-778 (dev pin `^0.87.1`) |
| eslint | 10.10.0 | 10.11.0 | **include** SP-778 |
| typebox | 1.3.30 | 1.3.34 | **include** SP-778 (exact pin `1.3.34`) |
| @types/node | 22.19.19 | 22.20.4 (22.x) | **include** SP-778 (stay 22.x) |
| @types/node | 22.x | 26.6.3 | **defer** (major) |
| typescript | 6.0.3 | 7.0.2 | **defer** (major) |

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #284 | enhancement P2 | SP-774–SP-777 (gap) | enh + doc | **Select** — reconcile/doctor typing; Closes #284 via SP-776 |
| dep hygiene | — | SP-778 (gap) | enh slot | **Select** — same-major bumps |
| #225 / #231 / #43 | epic / P3 | — | epic | **Defer** |
| #212, #211, #209, #135, #127, #124 | P3 | — | enh | **Defer** |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-774 | #284 | enh | M | Type reconcile-batch/orphan + reconcile facade | Partial #284 |
| SP-775 | #284 | enh | M | Type reconcile classify/diagnosis/context/light-cache | Partial #284; after SP-774 |
| SP-776 | #284 | enh | S | Type run-doctor-checks | **Closes #284**; after SP-775 |
| SP-777 | #284 | doc | S | Document #266 Phase 3 reconcile/doctor typing | after SP-776 |
| SP-778 | — | enh | S | Same-major dev dependency hygiene | parallel with SP-774 |

**Release scope ID:** `SP-774,SP-775,SP-776,SP-777,SP-778`

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #284 reconcile-batch/orphan | enh | SP-774 | create-spine-tasks (lean) |
| #284 classify/diagnosis | enh | SP-775 | create-spine-tasks (lean); deps SP-774 |
| #284 doctor | enh | SP-776 | create-spine-tasks (lean); deps SP-775 |
| #284 docs | doc | SP-777 | create-spine-tasks (lean); deps SP-776 |
| dep hygiene | enh | SP-778 | create-spine-tasks (lean) |

---

## Wave plan snapshot (expected)

```text
Wave 0 · SP-774 + SP-778 (parallel — typing vs package manifests; disjoint File Scope)
Wave 1 · SP-775 (after 774)
Wave 2 · SP-776 (after 775)
Wave 3 · SP-777 (after 776)
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #225 / #231 | epic | Matrix epic remainder |
| #212, #211, #209, #135, #127, #124, #43 | enh/epic | P3 / out of theme |
| typescript 7 / @types/node 26 | toolchain | Major — defer |

---

## Risks and blockers

- SP-774–776 all touch `tsconfig.batch.json` + `tests/arch/ts-nocheck-guard.test.mjs` — **serialized** via deps to avoid allowlist merge conflicts
- `reconcile-batch.mjs` has 8 lines of LOC headroom (492/500); do not grow `PHASE23_GRANDFATHERED_OVER_500`
- SP-778 (`@types/node` 22.20, typebox 1.3.34) can shift type surfaces under SP-774's batch tsc — post-integrate `release:check` after wave 0 catches cross-task drift
- SP-778 and SP-777 both edit `docs/adoption/operator-runbook.md` in different waves (0 vs 3) — no same-wave overlap
- Hygiene: `AGENTS.md` / `CLAUDE.md` dirty from GitNexus analyze — commit with packet staging before Phase 4 preflight

---

## Execution log

| Wave | Batch | Tasks | Merge on `main` | Post-integrate `release:check` | Notes |
|------|-------|-------|-----------------|--------------------------------|-------|
| 0 | `20260927T002714-6ad1` | SP-774, SP-778 | `b0fe8e23` (pushed) | exit 0 — 2651/2651 pass, 89.67% line coverage (`/tmp/pi-spine-post-integrate-wave-0.log`) | Filed [#293](https://github.com/beettlle/pi-spine/issues/293): detached engine rewrote `batch-state.json` after `batch complete` (late extended gate evidence); second `batch complete` cleared it. Amended SP-775/776/777 `fileScopeMustChange` (prelanded paths). |
| 1 | `20260927T010354-6c5d` | SP-775 | `749a48b7` (pushed) | exit 0 — 2651/2651 pass, 89.62% line coverage (`/tmp/pi-spine-post-integrate-wave-1.log`) | Waited for `batch.land_loop_finalized` before land loop (#293 workaround); state file stayed cleared. |
| 2 | `20260927T013808-0d36` | SP-776 | `ea3e4141` (pushed) | exit 0 — 2651/2651 pass, 89.69% line coverage (`/tmp/pi-spine-post-integrate-wave-2.log`) | #284 CLOSED; no #284 target left in `NOCHECK_ALLOWLIST`. |

**Out-of-scope bug filed:** #293 — not added to v2.24.0 scope (operator-approved composition unchanged).

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after each wave
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on release commit — exit 0 verified
- [ ] CI workflow green on HEAD
- [ ] `git status` clean; `main` in sync with `origin`
- [ ] No reconcile/doctor entries left in `NOCHECK_ALLOWLIST` for #284 targets
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded + stage approved
- [ ] Post-publish smoke
- [ ] Every release-scoped Closes CLOSED (#284)
