# Release manifest — v2.20.0

**Created:** 2026-09-05
**Current version:** 2.19.0
**Target version:** v2.20.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-09-05)
**Composition choice:** Close **all** open `priority:P2` issues (#280, #277, #266, #230, #229) with operator override of the minor enhancement budget (1–2 → 5 issues / 6 tasks). Bugs: **0** (operator override — no open bugs). Docs: embedded in enhancement packets (runbook / QUICK-REFERENCE). Deferred: P3 backlog + matrix epic remainder (#225/#231) + monitoring epics.
**Worker model pin:** `zai/glm-5.3-flash` via `agents.activeProfile: default` — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**GitNexus:** refreshed 2026-09-05 — status up-to-date with HEAD (`928dd2d`)

---

## Context

Operator request: **next minor** after v2.19.0 → **v2.20.0**, and **close all app P2 issues** even if scope expands beyond the default minor enhancement budget.

- Current `main`: `2.19.0`, synced with `origin/main` (`928dd2d`)
- Pending SP-*: **0** (Next Task ID **SP-747**)
- Open issues: **14**, all `enhancement` (0 documentation-labeled, 0 bugs)
- Open `priority:P2`: **5** — all selected
- Matrix predecessors #226/#227/#228/#232/#224: **CLOSED** (first-class row scheduling landed) — #229/#230 unblocked

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 0 standalone (docs ship inside enh packets) | 2–4 (minor) | PASS with **operator override** — runbook/QR updates are File Scope on SP-747/748/751/752 |
| Bug fixes | 0 | 3–5 | PASS with **operator override** (0 open bugs; 2026-09-05) |
| Enhancements | 5 issues / 6 tasks | 1–2 (minor) | PASS with **operator override** (close all P2; 2026-09-05) |
| **Total tasks** | 6 | 10–15 | PASS |

**Profile audit:** PASS with operator override (enhancement budget + bug floor + docs-as-embedded)

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #280 | enhancement P2 | SP-747 (gap) | enh | **Select** — gate `--synthesis` (I-PASS-lite) |
| #277 | enhancement P2 | SP-748 (gap) | enh | **Select** — optional Google quota probe |
| #266 | enhancement P2 | SP-749 + SP-750 (gap) | enh | **Select** — Phase 0 CI `@ts-nocheck` guard + Phase 1 high-risk typing; **Closes #266** after Phase 1 (Phase 2/3 follow-ups filed at delivery if needed) |
| #229 | enhancement P2 | SP-751 (gap) | enh | **Select** — matrix env vars + `matrixMaxParallel` |
| #230 | enhancement P2 | SP-752 (gap) | enh | **Select** — per-row status / retry / cancel; **depends on SP-751** |
| #225 | epic P3 | — | epic | **Defer** — parent epic; children #229/#230 close in this release |
| #231 | enhancement P3 | — | enh | **Defer** — matrix success policies |
| #212, #211, #209, #135, #127, #124, #43 | P3 / epic | — | enh | **Defer** — below P2 close-out theme |

---

## Selected tasks (release scope)

| SP-* | Issue | Size | Wave | Notes |
|------|-------|------|------|-------|
| SP-747 | #280 | S | 0 | Gate approve/reject `--synthesis`; runbook gate subsection |
| SP-748 | #277 | M | 0 | `probeGoogle` fail-closed; QUICK-REFERENCE probe row |
| SP-749 | #266 | S | 0 | Phase 0 — CI/arch guard against **new** `@ts-nocheck` (**Partial #266**) |
| SP-750 | #266 | M | 1 | Phase 1 typing; **depends on SP-749**; **Closes #266** |
| SP-751 | #229 | M | 1 | Matrix env + `matrixMaxParallel`; **depends on SP-747** (runbook serialize) |
| SP-752 | #230 | M | 2 | Per-row status/retry/cancel; **depends on SP-751** |

**Release scope IDs:** `SP-747,SP-748,SP-749,SP-750,SP-751,SP-752`

```bash
spine batch start SP-747,SP-748,SP-749,SP-750,SP-751,SP-752 --wave 0
```

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #280 | enh | SP-747 | create-spine-tasks (lean) |
| #277 | enh | SP-748 | create-spine-tasks (lean) |
| #266 Phase 0 | enh | SP-749 | create-spine-tasks (lean) |
| #266 Phase 1 | enh | SP-750 | create-spine-tasks (lean); deps SP-749 |
| #229 | enh | SP-751 | create-spine-tasks (lean) |
| #230 | enh | SP-752 | create-spine-tasks (lean); deps SP-751 |

---

## Wave plan snapshot

```text
Spine plan — ids
6 task(s) · 3 wave(s) · maxParallel 4

Wave 0 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-747 — Gate approve/reject optional synthesis note
  Lane 2: SP-748 — Optional Google quota probe for metrics quota
  Lane 3: SP-749 — CI/arch guard against new @ts-nocheck

Wave 1 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-750 — Phase 1 high-risk modules: remove @ts-nocheck
  Lane 2: SP-751 — Matrix index env vars and matrixMaxParallel

Wave 2 · 1 task
  Lane 1: SP-752 — Per-row matrix status, retry, and cancel
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #225 / #231 | epic / P3 | Matrix success policies + epic remainder after #229/#230 |
| #212, #211, #209 | P3 enh | MCP land-loop / outcome features / review light-path |
| #135, #127, #124, #43 | P3 / epic | Dashboard DAG, mailbox steering, wave strategies, monitoring toolkit |
| #266 Phase 2–3 | follow-up | engine-lanes + reconcile typing — file after Phase 1 if AC closed with Phase 0–1 only |

---

## Risks and blockers

- **#277 provider API:** If no suitable public Google usage/quota API exists for the consumer key class pi stores, packet must fail-closed document `absent` and either close as won't-fix with rationale or leave `blocked:provider-api` — operator asked to close P2s; prefer documented won't-fix close over inventing scrapers.
- **#266 size:** Full burn-down is L/XL; release closes via Phase 0+1 only (matches issue AC checklist focus). Phase 2–3 are follow-ups.
- **#230 ↔ #229:** Serialize via `dependencies.json` — both touch matrix row execution / runbook §2.4.
- **Quota-risk advisory (#251):** doctor warns on `zai` / Google escalate pins — advisory only; pin stays `zai/glm-5.3-flash` for this release.
- **Stale worktrees:** 3 leftover batch dirs — cleanup optional before waves; not blocking.

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD`
- [ ] CI workflow green on `HEAD` before tag
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke via `scripts/post-publish-smoke.sh 2.20.0`
- [ ] Every release-scoped `Closes #NNN` issue CLOSED on GitHub
