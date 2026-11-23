# Release manifest — v2.34.0

**Created:** 2026-11-22
**Current version:** 2.34.0 (tag `v2.34.0` / `319ecd83`; npm `latest` still **2.33.1** until stage 2FA approve)
**Target version:** v2.34.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-11-22) — include #386 with enh-budget override
**Operator approved publish:** yes (2026-11-23) — bump **minor** → v2.34.0
**Worker model pin:** `zai/glm-5.3-flash`, quota fallback profile `allegretto` — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none

**Theme:** Ship the dual-layer issue↔packet seam epic (#382) full child set: land sync + hydrate + thin-packet docs + board select (#383–#386), plus deferred P2/P3 land-loop bugs from v2.33 dogfood (#377–#379). Keep packets as execution SoR; do not implement issue-tracker-only execution.

---

## Release guardrails

| Field | Value | Enforcement |
|-------|-------|-------------|
| **M-size budget** | ≤ 4 M packets per wave | Serialize shared hot files via `dependencies.json` |
| **Scope freeze** | End of Phase 3 | Later work → next minor/patch |
| **Binary policy** | Checkout `node bin/spine.mjs` | Never `npm link`; global stays 2.33.1 until Phase 6 |
| **Epic policy** | Close #382 when #383–#386 all land | Done 2026-11-23 — all four children + epic CLOSED |

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | **1** (#385) | 2–4 | PASS (enhancement docs also land inside #383/#384/#386 packets) |
| Bug fixes | **3** (#377, #378, #379) | 3–5 | PASS |
| Enhancements | **3** (#383, #384, #386) | 1–2 | PASS with operator override (2026-11-22 — full #382 children) |
| **Total tasks** | **7** (gaps → SP-883–SP-889) | 10–15 | PASS |

**Profile audit:** PASS with operator override (enh count 3 > minor default 2; #386 included)

**#382 coverage this release:** children #383 + #384 + #385 + #386 (full epic). Close #382 after all four children land.

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@earendil-works/pi-coding-agent` 1.5.2 → **1.6.0** (≥1 minor); `@types/node` 22.20.4 → 22.20.5 / latest 26.x; typebox 1.3→1.4; typescript 6→7 majors |
| `npm audit` highs/criticals | **0 high, 0 critical** |
| Action | **deferred: enh slots filled by #382 children** — peer `pi-coding-agent` 1.6.0 threshold fired but counts against enh budget; no security highs. Prefer focused peer bump in a later patch/minor when enh budget free. |

---

## Intake table (Phase 1)

| Issue | Labels | Mapped SP-* | Bucket | Profile fit |
|-------|--------|-------------|--------|-------------|
| #385 | documentation, enhancement, skill:create-spine-tasks, P3 | **gap** → SP-883 | doc | **include** — thin-packet conventions (#382 child 3) |
| #377 | bug, P2 | **gap** → SP-884 | bug | **include** — tokens still empty after SP-878–880 |
| #378 | bug, P2 | **gap** → SP-885 | bug | **include** — retry does not refresh PROMPT from main |
| #379 | bug, P3 | **gap** → SP-886 | bug | **include** — `batch complete` race (#371 regression) |
| #383 | enhancement, P2 | **gap** → SP-887 | enh | **include** — land sync (#382 child 1) |
| #384 | enhancement, skill:create-spine-tasks, P2 | **gap** → SP-888 | enh | **include** — hydrate from issue (#382 child 2) |
| #386 | enhancement, P3 | **gap** → SP-889 | enh | **include** — board select; operator override |
| #382 | enhancement, P2, Epic | — | epic | **Closes** when SP-883–SP-889 all `.DONE` |
| #327 | bug, P3 | none | bug | **defer** — dashboard barrier UX |
| #361 | enhancement, P1 | none | enh | **defer** — tri-state checks; not #382 theme |
| #339 | enhancement, P2 | none | enh | **defer** — worker extension isolation |

Pending tasks: **0**. Next Task ID: **SP-883**.

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-883 | #385 | doc | S | Thin-packet authoring conventions + advisory validate note | **DONE** outside-spine `e33ffa86`; #385 CLOSED |
| SP-884 | #377 | bug | M | Fix live run-metrics tokensIn/tokensOut after SP-878–880 | Closes #377 |
| SP-885 | #378 | bug | S | Refresh PROMPT.md from base into lane on `batch retry` | Closes #378 |
| SP-886 | #379 | bug | S | Eliminate `batch complete` vs land-loop finalize race | Closes #379 |
| SP-887 | #383 | enh | M | Opt-in GitHub issue sync on land for Closes/Partial | Closes #383 |
| SP-888 | #384 | enh | M | Hydrate SP-* packet scaffold from GitHub issue | Closes #384 |
| SP-889 | #386 | enh | M | Select pending task IDs from GitHub label/milestone | Closes #386; with SP-883–888 closes #382 |

**Release scope ID:** `SP-883,SP-884,SP-885,SP-886,SP-887,SP-888,SP-889`

**Waves (from `spine plan` after Phase 3):**

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 | SP-883, SP-884 ∥ then SP-885 | Docs + metrics parallel; retry after (maxParallel 2) |
| 1 | SP-886 ∥ SP-888 | Complete-race after SP-885; hydrate after SP-883 |
| 2 | SP-887 | Land sync (after SP-886 runbook serialize) |
| 3 | SP-889 | Board select (after SP-887 parser) |

Serialize chain for shared runbook File Scope: SP-885 → SP-886 → SP-887 → SP-889.

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #385 | doc | SP-883 | create-spine-tasks (lean) |
| #377 | bug | SP-884 | create-spine-tasks (lean) |
| #378 | bug | SP-885 | create-spine-tasks (lean) |
| #379 | bug | SP-886 | create-spine-tasks (lean) |
| #383 | enh | SP-887 | create-spine-tasks (lean) |
| #384 | enh | SP-888 | create-spine-tasks (lean) |
| #386 | enh | SP-889 | create-spine-tasks (lean) |

---

## Wave plan snapshot

```text
7 task(s) · 4 wave(s) · maxParallel 2
Wave 0: SP-883 ∥ SP-884, then SP-885
Wave 1: SP-886 ∥ SP-888
Wave 2: SP-887
Wave 3: SP-889
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| Peer `pi-coding-agent` 1.6.0 | hygiene | Threshold fired; deferred — enh slots used by #382 children |
| TypeScript 7 / `@types/node` 26 | hygiene | Toolchain majors — later minor |
| #327 | bug (P3) | Dashboard barrier UX |
| #361 | enh (P1) | Tri-state checks — different theme |
| #339 | enh (P2) | Worker extension isolation |
| #324 / #366 / matrix epics | epic | Out of minor #382 theme |

---

## Risks and blockers

- **Root cause of wave0 SIGTERM (fixed `d26147ee`):** `pi --mode json` NDJSON (~2.2 MiB with extensions/rules) exceeded Node `spawnSync` default **1 MiB maxBuffer** → ENOBUFS/SIGTERM exit 143. Raised `WORKER_PI_JSON_MAX_BUFFER` to 64 MiB in `bin/spine-worker-runner.mjs`.
- **SP-885 landed** batch `20261122T230441-a680`; #378 CLOSED. Post-integrate `release:check` green (3387 pass, 91.69% lines). Hit #379 complete race; finalized via `ensureLandLoopFinalizedAfterGateOrIntegrate` after zombie engine kill.
- **#383 / #884 touch land/metrics hot paths** — M-sized.
- **Doctor advisories (non-blocking):** PATH pi mismatch; quota-risk; stet/swap pressure.
- **Agent pin override:** none.

---

---

## Execution log (Phase 4)

| SP-ID | Issue | Batch | Result |
|-------|-------|-------|--------|
| SP-883 | #385 | outside-spine + later | DONE — #385 CLOSED |
| SP-885 | #378 | `20261122T230441-a680` | DONE — #378 CLOSED |
| SP-886 | #379 | (with 885 land) | DONE — #379 CLOSED |
| SP-884 | #377 | `20261123T004523-5e9d` | DONE — #377 CLOSED (`0a667983`) |
| SP-887 | #383 | `20261123T020418-8268` | DONE — #383 CLOSED (`5e7c5f5e`) |
| SP-888 | #384 | `20261123T030746-c594` | DONE — #384 CLOSED (`c1d67e56`) |
| SP-889 | #386 | `20261123T041540-fcea` | DONE — #386 CLOSED (`34a19220`); #382 CLOSED |

**HEAD:** `34a19220` · `main` synced to `origin` · pending release scope: **0**

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main`
- [x] Post-integrate `release:check` green after **each wave** (logs under `/tmp/pi-spine-post-integrate-wave-*.log`)
- [x] `spine preflight` green
- [x] `npm run release:check` green on final `HEAD` (3436 pass, 91.33% lines) — log `/tmp/pi-spine-post-integrate-wave-889.log`
- [x] CI workflow green on `HEAD` — [run 45115841096](https://github.com/beettlle/pi-spine/actions/runs/45115841096) (pre-bump docs) / release commit CI as applicable
- [x] `git status` clean (`main` = `origin/main`)
- [x] Operator approved publish bump type: **minor** (2026-11-23)
- [x] `npm version minor` + `git push && git push --tags` → tag `v2.34.0` (`319ecd83`)
- [x] `release.yml` succeeded (OIDC stage) — [run 45219685709](https://github.com/beettlle/pi-spine/actions/runs/45219685709); GH Release https://github.com/beettlle/pi-spine/releases/tag/v2.34.0
- [ ] Maintainer 2FA approve staged package — **awaiting** (`npm view pi-spine version` still `2.33.1`)
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
- [x] Close remaining release-scoped `Closes #NNN` — #377–#379, #382–#386 all **CLOSED**
