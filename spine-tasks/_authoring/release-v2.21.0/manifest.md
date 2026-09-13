# Release manifest — v2.21.0

**Created:** 2026-09-13
**Current version:** 2.20.0
**Target version:** v2.21.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-09-13)
**Composition choice:** Standard — **#286** (`spine wait` silence) + **#285** Waves A–B (peer/security + TypeScript 6 / ESLint 10). Defer #285 Wave C (Actions majors). Split into 6 S/M packets to meet minor doc (2–4) and bug (3–5) floors without override. Enhancements: 1 (Wave B); Wave A counted as **bug/hygiene** (3 audit highs) while also clearing peer ≥1-minor drift.
**Worker model pin:** `zai/glm-5.3-flash` via `agents.worker.model` / default profile — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**GitNexus:** refreshed 2026-09-13 — status up-to-date with HEAD (`6621970`)

---

## Context

Operator request: **next v2.21** after v2.20.0 → **v2.21.0** (minor). Scope shape: **Standard (+ Wave B toolchain)**; meet profile floors by **splitting packets**.

- Current `main`: `2.20.0`, hygiene commit `6621970` (1 ahead of `origin` until push)
- Pending SP-*: **0** (Next Task ID **SP-753**)
- Open issues: **13** — 0 `documentation`, 1 `bug` (#286), rest `enhancement` / epics
- Dep drift: `pi-coding-agent` 0.80.3→0.85.1; `npm audit` **3 high** / 2 moderate (fix via peer 0.85.1 + `npm audit fix`)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 | 2–4 (minor) | PASS |
| Bug fixes | 3 | 3–5 | PASS |
| Enhancements | 1 | 1–2 (minor) | PASS |
| **Total tasks** | 6 | 10–15 | PASS |

**Profile audit:** PASS

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@earendil-works/pi-coding-agent` 0.80.3→**0.85.1**; `typescript` 5.6.3→7.0.2 (target **6.x** per #285); `eslint` 9.39.4→10.10.0; `globals` 16→17; `typebox` 1.1.38→1.3.x; `@types/node` stay 22.x |
| `npm audit` highs/criticals | **3 high** (brace-expansion, js-yaml, undici via pi-coding-agent), 0 critical, 2 moderate |
| Action | **include** SP-755 (#285 Wave A) + SP-758 (#285 Wave B); **defer** Wave C Actions majors + TypeScript 7 / `@types/node` 26 |

Intake snapshot: `spine-tasks/_authoring/release-v2.21.0/intake-snapshot-20260913.md`

### Deps mini-table

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| @earendil-works/pi-coding-agent | 0.80.3 | 0.85.1 | **include** SP-755 (#285 Wave A) |
| typebox | 1.1.38 | 1.3.30 | **include** with SP-755 |
| typescript | 5.6.3 | 7.0.2 | **include** → 6.x in SP-758 (not 7) |
| eslint | 9.39.4 | 10.10.0 | **include** SP-758 |
| globals | 16.5.0 | 17.12.0 | **include** SP-758 |
| @types/node | 22.19.19 | 26.5.1 | **defer** (stay 22.x) |

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #286 | bug | SP-753, SP-754, SP-756 (gaps) | bug + doc | **Select** — wait headlines + progress + docs |
| #285 | enhancement P1 | SP-755, SP-757, SP-758 (gaps) | bug/hygiene + doc + enh | **Select** Waves A–B; **Partial #285** (Wave C deferred) |
| #283 / #284 | enhancement P2 | — | enh | **Defer** — typing Phase 2–3; not in Standard scope |
| #225 / #231 | epic / P3 | — | epic | **Defer** — matrix epic remainder |
| #212, #211, #209, #135, #127, #124, #43 | P3 / epic | — | enh | **Defer** — below release theme |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-753 | #286 | bug | S | wait: human match/timeout/supersede headlines (P0) | **Partial #286**; `src/cli/wait.mjs` |
| SP-754 | #286 | bug | S | wait: start banner + periodic progress (P1) | **Partial #286**; depends SP-753 |
| SP-755 | #285 | bug | M | Wave A: pi-coding-agent ^0.85.1, typebox, engines, minPiVersion, audit clear | **Partial #285**; security + peer |
| SP-756 | #286 | doc | S | Document wait progress + agent outer-loop guidance (P2) | **Closes #286** after SP-753/754; skills + QUICK-REFERENCE |
| SP-757 | #285 | doc | S | Document peer bump, minPiVersion, engines for operators | **Partial #285**; docs only |
| SP-758 | #285 | enh | M | Wave B: TypeScript 6 + ESLint 10 + globals 17 | **Partial #285**; depends SP-755; embed migration notes in File Scope |

**Release scope ID:** `SP-753,SP-754,SP-755,SP-756,SP-757,SP-758`

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #286 P0 | bug | SP-753 | create-spine-tasks (lean) |
| #286 P1 | bug | SP-754 | create-spine-tasks (lean); deps SP-753 |
| #285 Wave A | bug | SP-755 | create-spine-tasks (lean) |
| #286 P2 | doc | SP-756 | create-spine-tasks (lean); deps SP-753,SP-754 |
| #285 Wave A docs | doc | SP-757 | create-spine-tasks (lean) |
| #285 Wave B | enh | SP-758 | create-spine-tasks (lean); deps SP-755 |

---

## Wave plan snapshot

```text
(expected after authoring — refine with spine plan SP-753,SP-754,SP-755,SP-756,SP-757,SP-758)

Wave 0 · parallel
  SP-753 — wait headlines (P0)
  SP-755 — peer/security Wave A
  SP-757 — peer/minPi docs (disjoint from SP-755 code paths if docs-only)

Wave 1 · after deps
  SP-754 — wait progress (depends SP-753)
  SP-756 — wait docs (depends SP-753,SP-754)
  SP-758 — TS6/ESLint10 (depends SP-755)
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #285 Wave C | enh / hygiene | Actions majors (checkout/setup-node/upload-artifact v7, github-script v9) — next release |
| #283 / #284 | enh P2 | engine-lanes + reconcile `@ts-nocheck` removal — out of Standard scope |
| #225 / #231 | epic / P3 | Matrix success policies + parent epic |
| #212, #211, #209, #135, #127, #124, #43 | P3 / epic | MCP land-loop, outcome export, review light-path, dashboard DAG, mailbox, wave strategies, monitoring toolkit |
| typescript 7 / @types/node 26 | toolchain | Explicitly out of #285 scope |

---

## Risks and blockers

- **Empty pending backlog** — all 6 packets are gaps; Phase 3 authoring required before execute
- **SP-755 / SP-758** may need real-pi / extension typecheck attention after peer + TS6 bumps
- Doctor **quota-risk advisory** (#251) on `zai/glm-5.3-flash` — advisory only; keep pin for release (F7)
- Hygiene commit `6621970` is **1 ahead of origin** — push after first green post-integrate gate (F8)
- Human-mode wait still silent on match (verified `src/cli/wait.mjs` ~266–276) — #286 still valid on 2.20.0

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] CI workflow green on `HEAD` (`gh run list --workflow ci.yml`)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke via `scripts/post-publish-smoke.sh 2.21.0`
- [ ] Every release-scoped `Closes #NNN` CLOSED on GitHub (§4.3c + Phase 6 sweep)
