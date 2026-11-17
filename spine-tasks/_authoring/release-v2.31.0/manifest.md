# Release manifest — v2.31.0

**Created:** 2026-11-16
**Current version:** 2.30.0 (published 2026-11-06, `aad31d39`; checkout HEAD `21bbc59d` ahead of origin by 2 local commits — push before Phase 4)
**Target version:** v2.31.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-11-16 — create all tasks and run all waves; publish approval deferred until Phase 5)
**Worker model pin:** `zai/glm-5.3-flash` (thinking high), quota fallback profile `allegretto` — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none

**Theme:** v2.30.0 dogfood recovery + release-gate hygiene from pi-smart-router / local release trains. Close the pause/retry dead-end (`stale_engine_pid`), stop `spine wait` from waking under live sibling lanes, restore post-salvage `complete`/`dismiss`, bound stet contract reviews to the retried task's commits, and make `mutating-help` snapshots ignore `git-ai` `refs/notes/*`. Lockfile peer bump to `pi-coding-agent` 1.5.2 (installed pi is already 1.5.2).

---

## Release guardrails (carried from v2.30.0)

| Field | Value | Enforcement |
|-------|-------|-------------|
| **M-size budget** | ≤ 2 M packets per release | Composition audit fails above 2 |
| **Scope freeze** | End of Phase 3 (packets authored + `spine plan` clean) | Later work goes to a patch release or the next manifest |
| **Binary policy** | Checkout `node bin/spine.mjs` for all release batches (dogfood unreleased main) | Never `npm link`; global stays 2.30.0 until Phase 6 |
| **Dependency chain depth** | ≤ 2 waves per batch | Prefer one batch if plan fits; split only if hot-file serial forces it |
| **Structural guards** | Every code `testCommand` includes `tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` and prefixes `npm run lint &&` | `spine-task-authoring.mdc` Definition of ready |
| **Host capacity** | `spine doctor` "stet review capacity" has no blocking swap exhaustion before each `batch start` | 2026-11-16 intake: swap nearly exhausted (0.9 GiB) — unload LM Studio / wait before Batch A |
| **Stet gate** | Default `contract.reviewPolicy` stays **advisory** unless operator opts into blocking for a later batch | #373 is the acceptance case for task-scoped stet ranges |

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 (SP-857, SP-858) | 2–4 | PASS |
| Bug fixes | 5 (SP-859..SP-863: #372, #375, #376, #374, #373) | 3–5 | PASS |
| Enhancements | 1 (SP-864 peer lockfile) | 1–2 | PASS |
| **M packets** | 0 (all proposed S) | ≤ 2 | PASS |
| **Total tasks** | 8 | 10–15 | PASS |

**Profile audit:** PASS (pending operator scope approval)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@earendil-works/pi-coding-agent` 1.4.0 → **1.5.2** (wanted 1.5.2); `eslint` 10.14.0 → 10.15.0; `@types/node` 22.20.4 → 22.20.5 (wanted) / 26.6.6 (latest); `typebox` 1.3.34 → 1.4.7; `typescript` 6.0.3 → 7.0.2 |
| `npm audit` highs/criticals | **0 high, 0 critical**, 4 moderate |
| Action | **include SP-864** (peer ≥1-minor drift on minor): lockfile / install to `pi-coding-agent` 1.5.2; optional same-packet `eslint` 10.15.0 patch. **Deferred:** TypeScript 7 (toolchain major), `@types/node` 26, `typebox` 1.4 — later hygiene. No open “Bump dependencies” issue — gap packet only. |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-857 | — | doc | S | Runbook: multi-lane `spine wait` + pause/retry / salvage land-loop recovery | Docs for #375/#376/#374 operator paths |
| SP-858 | — | doc | S | Release gate notes: git-ai `refs/notes` + peer pi 1.5.2 | Docs for #372 workaround + SP-864 |
| SP-859 | #372 | bug | S | mutating-help snapshot ignores `refs/notes/*` and `.git/ai/**` | Closes #372 |
| SP-860 | #375 | bug | S | `spine wait` must not match `needs_retry` while sibling lanes still running | Closes #375 |
| SP-861 | #376 | bug | S | pause/retry: no `stale_engine_pid` refuse; detached resume not blocked by false attached engine | Closes #376 |
| SP-862 | #374 | bug | S | After `salvage --integrate`, `complete` / `dismiss` succeed without `--force` | Closes #374 |
| SP-863 | #373 | bug | S | Stet contract review range = task commits only; dismissals survive task switches | Closes #373 |
| SP-864 | — | enh | S | Lockfile: `@earendil-works/pi-coding-agent` 1.5.2 (+ eslint 10.15 optional) | Dep hygiene; peer ≥1-minor |

**Release scope ID:** `SP-857,SP-858,SP-859,SP-860,SP-861,SP-862,SP-863,SP-864`

**Proposed Batch A (docs + hygiene + #372):** `SP-857,SP-858,SP-859,SP-864`
**Proposed Batch B (operator recovery bugs):** `SP-860,SP-861,SP-862,SP-863`

Serialize SP-861 and SP-862 if analyze shows shared hot files (`bin/spine-batch.mjs`, integrate/complete/dismiss). SP-860 (wait) and SP-863 (stet script) should be disjoint from that pair.

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| — (runbook recovery) | doc | SP-857 | create-spine-tasks (lean) |
| — (release gate notes) | doc | SP-858 | create-spine-tasks (lean) |
| #372 | bug | SP-859 | create-spine-tasks (lean) |
| #375 | bug | SP-860 | create-spine-tasks (lean) |
| #376 | bug | SP-861 | create-spine-tasks (lean) |
| #374 | bug | SP-862 | create-spine-tasks (lean) |
| #373 | bug | SP-863 | create-spine-tasks (lean) |
| peer 1.5.2 | enh | SP-864 | create-spine-tasks (lean) |

**Next Task ID after authoring:** SP-865

---

## Wave plan snapshot

```text
Single wave 0 · 8 tasks · 4 rounds (maxParallel 2):
  R1: SP-857 || SP-858
  R2: SP-859 || SP-860
  R3: SP-861 || SP-862
  R4: SP-863 || SP-864
Release scope: SP-857,SP-858,SP-859,SP-860,SP-861,SP-862,SP-863,SP-864
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #359 | bug P3 | Cosmetic gate line after integrate — next patch |
| #338 | bug P2 | run-metrics usage never populated — needs pi usage capture design |
| #331 | bug P2 | Post-hoc Step 0 plan review “premature completion” — M-sized prompt/engine work |
| #361 | enh P1 | Tri-state check results — large; keep for later minor |
| #358 | enh P2 | Schedule queued wave tasks onto freed lanes — epic-ish |
| #344 | enh P2 | Drop Taskplane from default rules profile — next minor |
| #366 / #324 / #225 | epic | Out of minor scope |
| TypeScript 7 / `@types/node` 26 / typebox 1.4 | hygiene | Toolchain majors — deferred |
| #309–#316, #319, audit leftovers | bug P2 | Brutal-audit cluster — separate train |
| Dashboard #327/#347/#348 | enh/bug | UI polish — defer |

---

## Risks and blockers

- **No pending SP-\*** at intake — entire scope is gap authoring (Phase 3).
- **Host swap** nearly exhausted (doctor warn) — unload LM Studio before Batch B if stet runs.
- **Local main is 2 commits ahead of origin** — push after Phase 3 packet commit (and after each land once `release:check` green).
- **Quota-risk advisory** on zai / kimi escalate pins — advisory only; keep pin; rely on `quotaFallbackProfile: allegretto`.
- **stale rules-manifest** doctor warn — run `node bin/spine.mjs rules sync` before first batch if still stale.
- Doctor PATH / global spine mtime skew — use `node bin/spine.mjs` only for this release.

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main` (batch `20261117T000334-0f39`, merge `85535994`)
- [x] Post-integrate `release:check` green after wave 0 — log `/tmp/pi-spine-post-integrate-wave-0.log` (3260/3260, 91.46%, exit 0)
- [x] `spine preflight` green (0 pending)
- [x] `npm run release:check` green on final `HEAD` (same log; CI parity)
- [x] CI workflow green on `HEAD` — https://github.com/beettlle/pi-spine/actions/runs/44002106275 (`conclusion: success`)
- [x] `git status` clean; `main` synced to `origin`
- [x] Operator approved publish bump type: **minor** (2026-11-17)
- [x] `npm version minor` + `git push && git push --tags` — tag `v2.31.0`, commit `6710faa0`
- [x] `release.yml` succeeded (OIDC stage) — https://github.com/beettlle/pi-spine/actions/runs/44137936724
- [x] Maintainer 2FA approve staged package; `npm view pi-spine version` = 2.31.0 (stage `172ac1ad-da11-40e0-8ec8-f63b5a77325e`)
- [x] Post-publish smoke per `docs/release/npm-publish.md` — `scripts/post-publish-smoke.sh 2.31.0` exit 0; global `spine --version` = 2.31.0
- [x] Every release-scoped `Closes #NNN` CLOSED (#372, #373, #374, #375, #376)
