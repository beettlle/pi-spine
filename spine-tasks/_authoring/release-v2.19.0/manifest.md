# Release manifest — v2.19.0

**Created:** 2026-09-04
**Current version:** 2.18.0
**Target version:** v2.19.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-09-04)
**Composition choice:** Docs-shaped #282 + #281; enh #278 + #279 (operator handoff quality cluster). Bugs: **0** (operator override — no open bugs). Deferred: #280, #277, #266, matrix epic, P3 backlog.
**Worker model pin:** `zai/glm-5.3-flash` via `agents.activeProfile: default` (set 2026-09-04 before Phase 4)
**Agent pin override:** yes — 2026-09-04 — operator switched from `allegretto` (`kimi-coding/k3`) to `default` before first wave (not expensive time of day; [#248](https://github.com/beettlle/pi-spine/issues/248) explicit pre-execution pin)
**GitNexus:** refreshed 2026-09-04 — status up-to-date with HEAD (`427a796`)

---

## Context

Operator request: **next minor** after v2.18.0 → **v2.19.0**.

- Current `main`: `2.18.0`, synced with `origin/main` (`427a796`)
- Pending SP-*: **0** (Next Task ID was SP-743)
- Open issues: **18**, all `enhancement` (0 documentation-labeled, 0 bugs)
- Theme chosen: **operator handoff quality** cluster (#282, #281, #278, #279)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 (#282, #281) | 2–4 (minor) | PASS — unlabeled but doc-shaped (runbook/rules/templates) |
| Bug fixes | 0 | 3–5 | PASS with **operator override** (0 open bugs; 2026-09-04) |
| Enhancements | 2 (#278, #279) | 1–2 (minor) | PASS |

**Total:** 4 tasks (S/M) — under 10–15 minor cap.

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #282 | enhancement P3 | SP-743 (gap) | doc | **Select** — handoff quality bar (runbook + operator rule) |
| #281 | enhancement P3 | SP-744 (gap) | doc | **Select** — disambiguate PROMPT Assessment |
| #278 | enhancement P2 | SP-745 (gap) | enh | **Select** — diagnose `background[]` / `assessmentReason` |
| #279 | enhancement P2 | SP-746 (gap) | enh | **Select** — issue-draft/handoff SBAR-shaped sections (soft dep #278) |
| #280 | enhancement P2 | — | enh | **Defer** — 2nd enh budget used; gate synthesis next minor |
| #277 | enhancement P2 | — | enh | **Defer** — Google quota probe; needs provider API research |
| #266 | enhancement P2 | — | enh | **Defer** — multi-phase `@ts-nocheck` burn-down (L) |
| #229–#231, #225 | enh / epic | — | enh | **Defer** — matrix epic children |
| #212, #211, #209, #135, #127, #124, #43 | P3 / epic | — | enh | **Defer** — below release theme / epic scope |

---

## Selected tasks (release scope)

| SP-* | Issue | Size | Wave | Notes |
|------|-------|------|------|-------|
| SP-743 | #282 | S | 0 | Docs-only — runbook + `spine-operator-cursor` |
| SP-744 | #281 | S | 0 | Docs-only — authoring template/rules Assessment→Risk/Problem theory |
| SP-745 | #278 | M | 0 | Diagnose packet fields + human `--diagnose` layout |
| SP-746 | #279 | M | 1 | issue-draft + handoff SBAR sections; **depends on SP-745** |

**Release scope IDs:** `SP-743,SP-744,SP-745,SP-746`

```bash
spine batch start SP-743,SP-744,SP-745,SP-746 --wave 0
```

---

## Wave plan snapshot

```text
Expected (after authoring):
Wave 0 · 3 tasks parallel (disjoint scopes)
  SP-743 — operator handoff quality bar (#282)
  SP-744 — PROMPT Assessment disambiguation (#281)
  SP-745 — diagnose background/assessmentReason (#278)
Wave 1 · 1 task
  SP-746 — issue-draft/handoff SBAR sections (#279) ← SP-745
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #280 | enh P2 | Gate `--synthesis` — next minor / 2nd-enh slot |
| #277 | enh P2 | Google quota probe — provider API research |
| #266 | enh P2 | `@ts-nocheck` burn-down — multi-phase L |
| #229,#230,#231 | enh | Matrix epic children (#225) |
| #225 | epic | Matrix job arrays |
| #212,#211,#209,#135,#127,#124,#43 | P3 / epic | Below theme / large |

---

## Risks and blockers

- Doctor quota-risk advisory (#251) on `zai` / escalate `google` — advisory only; pin stays `default` / `zai/glm-5.3-flash` unless operator overrides mid-release
- Dirty tree at intake: `AGENTS.md` / `CLAUDE.md` GitNexus count refresh — include in packet commit
- #279 soft-depends on #278 fields; hard dep SP-745 → SP-746 serializes wave 1
- 0 open documentation labels → treated #281/#282 as docs bucket with operator agreement

---

## Execution notes

### Wave 0 landed (2026-09-04)

- **Batch:** `20260904T173211-3f5a` — SP-743 / SP-744 / SP-745 terminal-success; tip `45e11f76`
- **Post-integrate:** first `release:check` failed phase23 LOC on `diagnosis.mjs` (643). Split → `diagnosis-handoff-packet.mjs` + `diagnosis-suggested-command.mjs` (`2c1a2abd`)
- **Retry log:** `/tmp/pi-spine-post-integrate-wave-0-retry.log` — 2564 pass, line coverage 88.43%; exit 0
- **Push:** `origin/main` at `2c1a2abd`
- **Issues closed:** #282 (SP-743), #281 (SP-744), #278 (SP-745)
- **Macro recovery:** `human_base_diverged` on `diagnosis.mjs` after LOC fix → `spine batch complete` → Idle

### Wave 1 landed (2026-09-04)

- **Batch:** `20260904T182217-1786` — SP-746 terminal-success; tip `58d1aa79`
- **Post-integrate:** first `release:check` failed `#222` slash-commands isolation flake (19.90%); retry `coverage:check` green (`/tmp/pi-spine-coverage-check-retry.log` — isolation 90.46%)
- **Push:** `origin/main` at `58d1aa79`
- **Issues closed:** #279 (SP-746)

### Publish (2026-09-04)

- **Phase 5:** CI green on `58d1aa79` — [33916294750](https://github.com/beettlle/pi-spine/actions/runs/33916294750)
- **Bump:** `npm version minor` → **v2.19.0** @ `a73b9ced`; `git push && git push --tags`
- **release.yml:** success — [33918406120](https://github.com/beettlle/pi-spine/actions/runs/33918406120)
- **Smoke:** first `post-publish-smoke.sh 2.19.0` exhausted retries (registry lag F9/#247); retry exit 0 (`/tmp/pi-spine-post-publish-smoke-2.19.0-retry.log`)
- **Issues:** #282, #281, #278, #279 all CLOSED

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main`
- [x] Post-integrate `release:check` green after **wave 0** (`/tmp/pi-spine-post-integrate-wave-0-retry.log`)
- [x] Post-integrate coverage gate green after **wave 1** (`/tmp/pi-spine-coverage-check-retry.log`)
- [x] `spine preflight` green
- [x] `npm run release:check` green on publish HEAD (preversion + Phase 6)
- [x] CI workflow green on pre-bump `HEAD` `58d1aa79`
- [x] Operator approved publish bump type: minor
- [x] `npm version minor` + `git push && git push --tags`
- [x] `release.yml` succeeded ([33918406120](https://github.com/beettlle/pi-spine/actions/runs/33918406120))
- [x] Post-publish smoke (`scripts/post-publish-smoke.sh 2.19.0` — retry after lag)
- [x] Every release-scoped `Closes #NNN` CLOSED (§4.3c + Phase 6 sweep): #282, #281, #278, #279
