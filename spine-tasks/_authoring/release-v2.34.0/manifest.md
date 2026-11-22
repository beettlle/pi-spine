# Release manifest — v2.34.0

**Created:** 2026-11-22
**Current version:** 2.33.1 (published; checkout HEAD `be0e645b` = `origin/main`)
**Target version:** v2.34.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-11-22) — include #386 with enh-budget override
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
| **Epic policy** | Children close; epic stays OPEN until #386 | Packets use `Closes #383/#384/#385/#377–#379`; `Partial #382` only if needed |

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

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] CI workflow green on `HEAD` (`ci.yml`)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded (OIDC stage)
- [ ] Maintainer 2FA approve staged package
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
- [ ] Close remaining release-scoped `Closes #NNN` (sweep); leave #382/#386 OPEN
