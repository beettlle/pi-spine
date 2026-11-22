# Release manifest — v2.33.1

**Created:** 2026-11-21
**Current version:** 2.33.0 (published; checkout HEAD `cd3f5064` = `origin/main`)
**Target version:** v2.33.1
**Bump type:** patch
**Profile:** patch (**emergency hotfix** — P0 regressions from v2.33.0 SP-878/879)
**Operator approved scope:** yes (2026-11-21) — emergency patch invoked for #380/#381
**Worker model pin:** `zai/glm-5.3-flash`, quota fallback profile `allegretto` — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**Operator approved publish:** yes (2026-11-21) — bump **patch** → v2.33.1

**Theme:** Emergency patch. Stop salvage thrash from `worker-usage.json` (#380) and stop journaling full `--mode json` system-prompt stdout into `task.failed` (#381). No enhancements. No open documentation issues required for hotfix.

---

## Release guardrails

| Field | Value | Enforcement |
|-------|-------|-------------|
| **M-size budget** | ≤ 2 M packets | Prefer S only for patch |
| **Scope freeze** | End of Phase 3 | Later work → next patch |
| **Binary policy** | Checkout `node bin/spine.mjs` | Never `npm link`; global stays 2.33.0 until Phase 6 |
| **Host capacity** | Doctor stet/swap before batches | Intake: swap nearly exhausted (0.5 GiB) — unload LM Studio before waves |

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 0 | 1–2 small | PASS with emergency override (hotfix; no open doc issues) |
| Bug fixes | **2** (#380, #381) | 3–5 | PASS with emergency override (under target; only P0s in scope) |
| Enhancements | **0** | 0 patch | PASS |
| **M packets** | **0** | ≤ 2 | PASS |
| **Total tasks** | 2 (gaps → SP-881, SP-882) | 5–8 patch | PASS |

**Profile audit:** PASS with operator override (emergency 2-bug patch under usual 3–5 bug target)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `pi-coding-agent` 1.5.2 → 1.6.0; `@types/node` 22.20.4 → 22.20.5 / 26.6.6; typebox/typescript majors. |
| `npm audit` highs/criticals | **0 high, 0 critical** |
| Action | **deferred: deps OK for patch** — no audit high. Peer `pi-coding-agent` 1.6.0 is ≥1-minor; patch profile defers peer bumps unless security. |

---

## Intake table (Phase 1)

| Issue | Labels | Mapped SP-* | Bucket | Profile fit |
|-------|--------|-------------|--------|-------------|
| #380 | bug, P1 | **gap** → SP-881 | bug | **include** — P0 salvage thrash |
| #381 | bug, P1 | **gap** → SP-882 | bug | **include** — P0 truncated task.failed blinds UI |
| #377 | bug, P2 | none | bug | **defer** — usage still empty; not thrash blocker |
| #378 | bug, P2 | none | bug | **defer** — retry PROMPT sync |
| #379 | bug, P3 | none | bug | **defer** — batch complete race |
| #327 | bug, P3 | none | bug | **defer** — dashboard barrier UX |

Pending tasks: **0**. Next Task ID: **SP-881**.

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-881 | #380 | bug | S | Exclude `worker-usage.json` from salvage/dirty scope; treat as engine artifact | Closes #380 |
| SP-882 | #381 | bug | S | Summarize `--mode json` failure output for `task.failed` (no system-prompt dump) | Closes #381 |

**Release scope ID:** `SP-881,SP-882`

**Proposed Batch A:** `SP-881,SP-882` — disjoint file scopes (salvage/dirty vs worker-host/journal payload shaping); same wave OK if analyze shows no overlap.

### Design notes

| Packet | Scope | Why S |
|--------|-------|-------|
| SP-881 | `WORKER_USAGE_SIDECAR` known to salvage/`resolveScopedDirtyPaths` / `GITIGNORED_ARTIFACT_MARKERS`; optional move sidecar under `.spine/runtime` **or** keep path but exclude from dirty/salvage; init/gitignore template if present | Pure hygiene — do not invent costs; keep usage read path working |
| SP-882 | Before journal `task.failed`, replace raw JSONL stdout with `{exitCode, classification, summary, outputTail}` using pi-json text extract / strip `message_start` system sections | Dashboard shows readable reason under 32 KiB |

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #380 | bug | SP-881 | create-spine-tasks (lean) |
| #381 | bug | SP-882 | create-spine-tasks (lean) |

---

## Deferred backlog

| Item | Rationale |
|------|-----------|
| #377 | Usage fields empty on some dogfood runs — separate from thrash |
| #378 | Retry PROMPT refresh |
| #379 | batch complete race |
| #327 | Dashboard P3 |
| `pi-coding-agent` 1.6.0 | Patch — defer peer bump |

---

## Risks and blockers

- Swap nearly exhausted — unload LM Studio before Phase 4.
- Hot files near SP-879 paths — keep SP-881 focused on salvage/dirty markers, not rewiring usage emit.
- SP-882 must not drop useful assistant/error tails when summarizing.

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main` (outside-spine hotfix)
- [x] Post-integrate `release:check` green (`/tmp/pi-spine-release-check-v2331.log`, exit 0, 3382 pass)
- [x] `spine preflight` green
- [x] `npm run release:check` green on final `HEAD` (`7be0f549`, exit 0)
- [x] CI workflow green on `HEAD` — [run 44963133786](https://github.com/beettlle/pi-spine/actions/runs/44963133786) success
- [x] `git status` clean
- [x] Operator approved publish bump type: **patch**
- [x] `npm version patch` + `git push && git push --tags` (`834ee202`, tag `v2.33.1`)
- [x] `release.yml` succeeded (OIDC stage) — [run 44968183458](https://github.com/beettlle/pi-spine/actions/runs/44968183458)
- [ ] Maintainer 2FA approved; `npm view pi-spine version` = 2.33.1
- [ ] Post-publish smoke
- [ ] Close `Closes #NNN` sweep (expect #380 #381)
