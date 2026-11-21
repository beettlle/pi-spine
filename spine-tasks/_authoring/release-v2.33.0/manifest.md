# Release manifest — v2.33.0

**Created:** 2026-11-19
**Current version:** 2.32.0 (published; checkout HEAD `885544be` = `origin/main`)
**Target version:** v2.33.0
**Bump type:** minor
**Profile:** minor (**operator override: bug-only** — 0 enhancements; docs optional/minimal)
**Operator approved scope:** yes (2026-11-19)
**Worker model pin:** `zai/glm-5.3-flash`, quota fallback profile `allegretto` — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**Operator approved publish:** yes (2026-11-20) — bump **minor** → v2.33.0

**Theme:** Bug-only minor. Clear the oldest open Sep/Oct `label:bug` backlog (plan-review dead ends, reconcile fail-open, matrix slot leaks, audit leftovers) plus #338 run-metrics usage producers (split into three S packets). No enhancements. No open documentation issues at intake.

---

## Release guardrails (carried from v2.32.0)

| Field | Value | Enforcement |
|-------|-------|-------------|
| **M-size budget** | ≤ 2 M packets per release | Composition audit fails above 2 |
| **Scope freeze** | End of Phase 3 (packets authored + `spine plan` clean) | Later work → patch or next manifest |
| **Binary policy** | Checkout `node bin/spine.mjs` for all release batches | Never `npm link`; global stays 2.32.0 until Phase 6 |
| **Dependency chain depth** | ≤ 2 waves per batch | Prefer one batch if plan fits |
| **Structural guards** | Code `testCommand` includes phase23 + ts-nocheck guards; prefixes `npm run lint &&` | `spine-task-authoring.mdc` |
| **Host capacity** | Doctor stet capacity / swap before each `batch start` | Intake: stale foreign `--attached` PID 46373 + swap nearly exhausted — unload / wait before waves |
| **Stet gate** | Default `contract.reviewPolicy` stays **advisory** unless operator opts in | unchanged |

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 0 | 2–4 (minor) / 0–1 (bug-only override) | PASS with operator override (bug-only; no open doc issues) |
| Bug fixes | 6 issues → **8** S packets (#331, #294, #310, #311, #319, #338×3) | 3–5 issues / patch-like task cap 5–8 | PASS with operator override (bug count by **issue** = 6; task total 8 fits minor; exceeds patch 5–8 only if counting packets — operator OK for #338 split) |
| Enhancements | **0** | 1–2 minor → **0** bug-only | PASS with operator override |
| **M packets** | **0** (#338 split into S; plan-review stays S) | ≤ 2 | PASS |
| **Total tasks** | 8 (all gaps → new SP-*) | 10–15 minor | PASS |

**Profile audit:** PASS with operator override (bug-only on minor bump; #338 included as three S packets; awaiting scope approval)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@types/node` 22.20.4 → 22.20.5 (wanted) / 26.6.6 (latest); `typebox` 1.3.34 → 1.4.7; `typescript` 6.0.3 → 7.0.2. No `pi-coding-agent` drift recorded as peer ≥1-minor for include. |
| `npm audit` highs/criticals | **0 high, 0 critical** (total 0) |
| Action | **deferred: deps OK** — no audit high; toolchain majors / typebox minor deferred (bug-only; no enh/hygiene slot). |

---

## Intake table (Phase 1)

| Issue | Created | Labels | Mapped SP-* | Bucket | Profile fit |
|-------|---------|--------|-------------|--------|-------------|
| #331 | 2026-09-29 | bug, P2 | **gap** → SP-873 | bug | **include** — post-hoc plan review REVISE → `review_exhausted` |
| #294 | 2026-09-27 | bug | Partial via SP-814 (item 3); items 1–2 **gap** → SP-874 | bug | **include** — step-0 plan review spawn ordering |
| #310 | 2026-09-27 | bug, P2 | **gap** → SP-875 | bug | **include** — reconcile git helpers fail-open |
| #311 | 2026-09-27 | bug, P2 | **gap** → SP-876 | bug | **include** — matrix lane slot leak + packet fallback |
| #319 | 2026-09-27 | bug, P2 | **gap** → SP-877 | bug | **include** — audit leftovers (fileScope / contract.errors / fake-async) |
| #327 | 2026-09-28 | bug, P3 | none | bug | **defer** — dashboard cosmetic at barrier; P3 |
| #338 | 2026-10-10 | bug, P2 | SP-837 closed #325 only; usage still empty | bug | **include** — split M → **3×S** (SP-878…SP-880) |

Pending tasks at intake: **0** (`spine plan pending` empty). Next Task ID: **SP-873**.

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-873 | #331 | bug | S | Post-hoc Step 0 plan review: do not reject finished work as premature | Closes #331 |
| SP-874 | #294 | bug | S | Step-0 plan review spawn ordering (before later-step plan reviews) | Closes #294 (remaining items 1–2) |
| SP-875 | #310 | bug | S | Reconcile git helpers: surface errors/timeouts; drop hardcoded operator branches | Closes #310 |
| SP-876 | #311 | bug | S | Matrix: release lane slot if state save throws; do not swallow packet load errors | Closes #311 |
| SP-877 | #319 | bug | S | Audit leftovers: validate fileScope fallback, surface contract.errors, fake-async guard for `bin/` | Closes #319 |
| SP-878 | #338 | bug | S | Parse pi `--mode json` stream → usage totals (+ text for logs); fixture unit tests | Partial #338; pure helper |
| SP-879 | #338 | bug | S | Worker: spawn with `--mode json`, persist usage, set `task.tokensIn/Out` before metric | Partial #338; requires SP-878 |
| SP-880 | #338 | bug | S | Reviewer: JSON mode + usage on `buildReviewMetricRecord`; fixture `metrics show` rollup | **Closes #338**; requires SP-878 |

**Release scope ID:** `SP-873,SP-874,SP-875,SP-876,SP-877,SP-878,SP-879,SP-880`

**Proposed Batch A (plan-review):** `SP-873,SP-874` — serialize if shared `review-step*.mjs`
**Proposed Batch B (reconcile + matrix + audit leftovers):** `SP-875,SP-876,SP-877`
**Proposed Batch C (#338 usage chain):** `SP-878` then `SP-879,SP-880` (878 first; 879∥880 if file scopes stay disjoint — worker-runner vs review-spawn/metrics)

### #338 M→S split (design)

Issue proposed one M: `--mode json` + stream sum + attach to worker/reviewer metrics + fixture. Surface after SP-837:

| Packet | Scope | Why S |
|--------|-------|-------|
| SP-878 | New `src/batch/pi-json-usage.mjs` + `tests/fixtures/…` + unit tests | Pure parse/sum; no spawn. No invented costs when usage absent. |
| SP-879 | `bin/spine-worker-runner.mjs` (`buildWorkerPiArgs` + post-`spawnSync`), sidecar or task fields → `recordLaneTaskMetric` | Worker-only; stubs omit fields. |
| SP-880 | `src/batch/review-spawn.mjs`, `metrics.mjs` (`buildReviewMetricRecord` usage keys), review emit sites, fixture → `spine metrics show` | Reviewer-only; **Closes #338** when AC met. |

`buildTaskMetricRecord` already copies `task.tokensIn/Out/estimatedUsd` when finite; `buildReviewMetricRecord` does **not** yet — SP-880 adds that. Rollups already group by role when fields exist.

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #331 | bug | SP-873 | create-spine-tasks (lean) |
| #294 | bug | SP-874 | create-spine-tasks (lean) |
| #310 | bug | SP-875 | create-spine-tasks (lean) |
| #311 | bug | SP-876 | create-spine-tasks (lean) |
| #319 | bug | SP-877 | create-spine-tasks (lean) |
| #338 | bug | SP-878, SP-879, SP-880 | create-spine-tasks (lean); chain Partial→Closes |

---

## Wave plan snapshot

```text
Spine plan — ids
8 task(s) · 2 wave(s) · maxParallel 2

Wave 0 · 6 tasks · 3 rounds (queued by maxParallel)
  Round 1: SP-873 || SP-874
  Round 2: SP-875 || SP-876
  Round 3: SP-877 || SP-878
Wave 1 · 2 tasks · 2 lanes in parallel
  SP-879 || SP-880 (both require SP-878)

Validated 2026-11-19: spine tasks validate SP-873…SP-880 → 8 passed
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #327 | bug P3 | Dashboard barrier UX; still deferred |
| #361–#366, #360, #358, #348–#347, #341, #339, #326, #324 epic, #323–#312, #231–#43 | enh / epic | Bug-only release — all enhancements deferred |
| TypeScript 7 / `@types/node` 26 / typebox 1.4 | deps | No audit high; bug-only — no enh/hygiene slot |

---

## Risks and blockers

- **All selected issues are gaps** — Phase 3 must author SP-873…SP-880 before any batch.
- **Plan-review cluster (#331 + #294)** may share hot files (`src/batch/review-step*.mjs`); serialize via `dependencies.json` if analyze shows overlap.
- **#338 chain:** SP-879/SP-880 require SP-878; do not parallel 878 with dependents. Confirm pi JSON event shape against current pi (1.5.2) when authoring SP-878 fixtures.
- **Host:** doctor reports stale foreign `spine … --attached` PID 46373 and swap nearly exhausted — unload LM Studio / confirm no collision before Phase 4.
- **Quota-risk advisory (#251):** worker pin `zai/glm-5.3-flash` / escalate `kimi-coding` — advisory only; do not mid-release pin-thrash.
- This repo batch is **idle**; do not start a second batch if another becomes running.

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main`
- [x] Post-integrate `release:check` green after **each wave** (`/tmp/pi-spine-post-integrate-wave-0.log`, `/tmp/pi-spine-post-integrate-wave-1.log`)
- [x] `spine preflight` green
- [x] `npm run release:check` green on final `HEAD` (re-run exit 0; first Phase 5 attempt aborted mid-suite flake)
- [x] CI workflow green on `HEAD` (run 44842554393 success on `99bcdcf9`)
- [x] `git status` clean
- [x] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded (OIDC stage)
- [ ] Maintainer 2FA approved staged package; `npm view pi-spine version` = 2.33.0
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
- [x] Close remaining `Closes #NNN` sweep (#331 #294 #310 #311 #319 #338 CLOSED)
