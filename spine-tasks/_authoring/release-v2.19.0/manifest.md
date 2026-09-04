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

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after each wave
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD`
- [ ] CI workflow green on `HEAD`
- [ ] Clean git tree
- [ ] Operator approved publish bump type: minor
- [ ] Every release-scoped `Closes #NNN` CLOSED (§4.3c + Phase 6 sweep)
