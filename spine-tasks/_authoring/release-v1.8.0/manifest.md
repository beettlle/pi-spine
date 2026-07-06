# Release manifest — v1.8.0

**Created:** 2026-07-05
**Current version:** 1.7.0
**Target version:** v1.8.0
**Bump type:** minor
**Profile:** minor (operator override: audit issues #176–#183 prioritized)
**Operator approved scope:** yes (2026-07-05 — user requested v1.8.0 with audit #176–#183 priority)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 0 | 2–4 | PASS (audit-only release) |
| Bug fixes | 0 | 3–5 | WARN (operator override — audit hardening) |
| Enhancements | 8 issues → 12 tasks | 1–2 | PASS with operator override |
| **Total tasks** | 12 | 10–15 | PASS |

**Profile audit:** PASS with operator override (audit-driven minor; #176–#183 decomposed)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-497 | #182 | enh | S | DRY: extract shared PROMPT Size line parser | Closes #182 |
| SP-498 | #181 | enh | S | Dashboard: safe gate status DOM (no innerHTML) | Closes #181 |
| SP-499 | #180 | enh | S | Bump devDeps to resolve npm audit highs | Closes #180 |
| SP-500 | #179 | enh | M | Expand ESLint baseline beyond 4 rules | Closes #179 |
| SP-501 | #178 | enh | M | Enable checkJs on batch hot paths | Closes #178 (extends SP-275) |
| SP-502 | #183 | enh | S | Preflight: batch-read PROMPT.md async | Closes #183 |
| SP-503 | #176 | enh | M | Split preflight: discovery + validate module | Partial #176 |
| SP-504 | #176 | enh | M | Split preflight: git + batch guard modules | Partial #176 |
| SP-505 | #176 | enh | M | Split preflight: integrate + plan modules | Closes #176 |
| SP-506 | #177 | enh | M | Split dashboard: lane row builders | Partial #177 |
| SP-507 | #177 | enh | M | Split dashboard: wave + tail activity builders | Partial #177 |
| SP-508 | #177 | enh | S | Split dashboard: thin snapshot assembly | Closes #177 |

**Release scope ID:** `SP-497,SP-498,SP-499,SP-500,SP-501,SP-502,SP-503,SP-504,SP-505,SP-506,SP-507,SP-508`

---

## Gaps requiring new packets

All 12 packets authored in Phase 3 (SP-497–SP-508).

---

## Wave plan snapshot

```text
Wave 0 · 4 tasks · 4 lanes parallel
  SP-497, SP-498, SP-499, SP-500

Wave 1 · 2 tasks · 2 lanes parallel
  SP-501, SP-502

Wave 2 · 3 tasks · serial (preflight split chain)
  SP-503 → SP-504 → SP-505

Wave 3 · 3 tasks · serial (dashboard split chain)
  SP-506 → SP-507 → SP-508
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| SP-453, SP-455, SP-456 | pending | Outside v1.8.0 audit scope |
| #117 | epic | v2.3 batch module split — separate from audit dashboard/preflight scope |

---

## Risks and blockers

- SP-502 must land before SP-503 (same `spine-preflight-lib.mjs` hot file)
- Preflight/dashboard splits are Strangler Fig — each wave must keep public API stable
- #178 supersedes partial SP-275 delivery (`checkJs: false` still in tsconfig.batch.json)

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run release:check` green
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
