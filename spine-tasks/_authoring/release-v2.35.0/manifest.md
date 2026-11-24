# Release manifest — v2.35.0

**Created:** 2026-11-23
**Current version:** 2.35.0 (published; tag `v2.35.0` / `2b8ef799`; npm `latest` **2.35.0**)
**Target version:** v2.35.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-11-23) — SP-891 split into S packets; start development
**Operator approved publish:** yes (2026-11-24) — bump **minor** → v2.35.0
**Worker model pin:** `zai/glm-5.3-flash`, quota fallback profile `allegretto` — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none

**Theme:** Rename the v2.34 GitHub-branded issue↔packet seam to forge-neutral `integrations.issues` + `provider` (#387). Breaking rename OK (feature still new). No GitLab/Bitbucket adapters this release.

---

## Release guardrails

| Field | Value | Enforcement |
|-------|-------|-------------|
| **M-size budget** | ≤ 4 M packets per wave | All S this release |
| **Scope freeze** | End of Phase 3 | Later work → next minor/patch |
| **Binary policy** | Checkout `node bin/spine.mjs` | Never `npm link`; global stays 2.34.0 until Phase 6 |
| **Epic policy** | n/a — single issue #387 | Close #387 when SP-896 lands |

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | **1** (SP-896) | 2–4 | WARN — 0 open `documentation` issues; docs AC folded into #387 |
| Bug fixes | **0** | 3–5 | WARN — only #327 open; deferred (out of theme) |
| Enhancements | **1** issue (#387 → 6 code packets) | 1–2 | PASS |
| **Total tasks** | **7** (SP-890–SP-896) | 10–15 | PASS |

**Profile audit:** PASS with operator override (2026-11-23) — docs < 2 and bugs < 3; #387-focused minor; SP-891 split into three S packets

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@earendil-works/pi-coding-agent` **1.5.2 → 1.6.0** (≥1 minor); `@types/node` 22.20.4 → 22.20.5 / latest 26.x; typebox 1.3→1.4; typescript 6→7 majors |
| `npm audit` highs/criticals | **0 high, 0 critical** |
| Action | **deferred: enh slot filled by #387** — peer 1.6.0 threshold fired but counts against enh budget; no security highs. TypeScript 7 / `@types/node` 26 majors deferred. |

---

## Intake table (Phase 1)

| Issue | Labels | Mapped SP-* | Bucket | Profile fit |
|-------|--------|-------------|--------|-------------|
| #387 | enhancement, P2 | SP-890–SP-896 | enh (+doc) | **include** — operator-requested |
| #327 | bug, P3 | none | bug | **defer** — out of theme |
| Remaining ~30 | various | none | enh/epic | **defer** |

Pending tasks after Phase 3: SP-890–SP-896. Next Task ID after authoring: **SP-897**.

GitNexus: refreshed 2026-11-23 — Status up-to-date at `8415d9c`.

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-890 | #387 | enh | S | Config: `integrations.issues` + `provider`; reject `integrations.github`; update sync config reader | Partial #387 |
| SP-891 | #387 | enh | S | Move `mission-issue-links.mjs` → `src/integrations/issues/` | Partial #387; after SP-890 |
| SP-892 | #387 | enh | S | Add `providers/github.mjs`; extract `gh` runner from sync-on-land | Partial #387; after SP-891 |
| SP-893 | #387 | enh | S | Move `sync-on-land.mjs` → `issues/`; rewire integrate; remove `github/` | Partial #387; after SP-892 |
| SP-894 | #387 | enh | S | CLI: `--no-issue-sync`, `--issue-label` | Partial #387; after SP-893 |
| SP-895 | #387 | enh | S | Journal: `issues.synced` / `issues.sync_failed` | Partial #387; after SP-893 |
| SP-896 | #387 | doc | S | Docs/skills: “issue tracker ↔ packets” | **Closes #387**; after SP-894+SP-895 |

**Release scope ID:** `SP-890,SP-891,SP-892,SP-893,SP-894,SP-895,SP-896`

**Deps:** SP-890 → SP-891 → SP-892 → SP-893 → SP-894 → SP-895 → SP-896

**Proposed waves (re-plan after Phase 3):**

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 | SP-890 | Config schema + reader |
| 1 | SP-891 | Mission links path move |
| 2 | SP-892 | GitHub provider extract |
| 3 | SP-893 | Sync module move |
| 4 | SP-894 | CLI flags (may touch sync-on-land) |
| 5 | SP-895 | Journal events (serialize after SP-894) |
| 6 | SP-896 | Docs; closes #387 |

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #387 | enh | SP-890–SP-895 | create-spine-tasks (lean) |
| #387 | doc | SP-896 | create-spine-tasks (lean) |

---

## Wave plan snapshot

```text
7 task(s) · 7 wave(s) · maxParallel 2
Wave 0: SP-890
Wave 1: SP-891
Wave 2: SP-892
Wave 3: SP-893
Wave 4: SP-894
Wave 5: SP-895
Wave 6: SP-896
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #327 | bug | P3 dashboard barrier UX; out of #387 theme |
| pi-coding-agent 1.6.0 | dep hygiene | Threshold fired; enh budget used by #387; audit clean |
| TypeScript 7 / @types/node 26 | toolchain major | not this theme |
| #361 / #339 / epics | enh/epic | Exceed minor enh budget |

---

## Risks and blockers

- Breaking rename: no silent alias for `integrations.github` — fail closed with clear error (per #387 AC)
- SP-890 must update sync config reader in the same wave as schema or sync breaks until SP-893
- Hot shared docs: serialize SP-896 after code packets
- Doctor advisories (non-blocking): PATH pi mismatch, quota-risk pins, stale worktree, stet swap nearly exhausted

---

## Execution log (Phase 4)

| SP-ID | Issue | Batch | Result |
|-------|-------|-------|--------|
| SP-890 | #387 | `20261123T185351-42ce` | DONE |
| SP-891 | #387 | `20261123T202505-d3ad` | DONE |
| SP-892 | #387 | `20261123T215213-86ff` | DONE |
| SP-893 | #387 | `20261123T232853-1f37` | DONE |
| SP-894 | #387 | `20261123T235355-04b6` | DONE |
| SP-895 | #387 | `20261124T004019-6b1e` | DONE |
| SP-896 | #387 | `20261124T010846-bc2e` | DONE — #387 CLOSED |

**HEAD (pre-bump):** `a463c9bb` · `main` synced · pending release scope: **0**

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main`
- [x] Post-integrate `release:check` green after **each wave** (logs `/tmp/pi-spine-post-integrate-wave-*.log`)
- [x] `spine preflight` green
- [x] `npm run release:check` green on final pre-bump `HEAD` `a463c9bb` (3450 pass, 91.32% lines) — `/tmp/pi-spine-release-check.log`; `preversion` re-check on bump (3450 pass, 91.37%)
- [x] CI workflow green on `a463c9bb` — [run 45305824435](https://github.com/beettlle/pi-spine/actions/runs/45305824435)
- [x] `git status` clean (`main` = `origin/main` after tag push)
- [x] Operator approved publish bump type: **minor** (2026-11-24)
- [x] `npm version minor` + `git push && git push --tags` → tag `v2.35.0` (`2b8ef799`)
- [x] `release.yml` succeeded (OIDC stage) — [run 45314048333](https://github.com/beettlle/pi-spine/actions/runs/45314048333); GH Release https://github.com/beettlle/pi-spine/releases/tag/v2.35.0
- [x] Maintainer 2FA approve staged package — stage `d53b3f4b-d291-49cc-9b8e-3126e5e66184` approved; `npm view pi-spine version` = **2.35.0**
- [x] Post-publish smoke — `scripts/post-publish-smoke.sh 2.35.0` OK; global `spine --version` = 2.35.0
- [x] Close remaining release-scoped `Closes #NNN` — #387 **CLOSED**
