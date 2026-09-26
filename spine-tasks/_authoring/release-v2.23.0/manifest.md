# Release manifest — v2.23.0

**Created:** 2026-09-26
**Current version:** 2.22.0
**Target version:** v2.23.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-09-26)
**Composition choice:** Standard A — Close #285 Wave C (Actions majors) + #283 engine-lanes typing. Defer #284 and P3/epics. Operator selected 2026-09-26.
**Worker model pin:** `zai/glm-5.3-flash` via `agents.worker.model` / default profile — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**GitNexus:** refreshed 2026-09-26 — status up-to-date with HEAD (`3743545c`)

---

## Context

Operator request: **next v2.23** after v2.22.0 → **v2.23.0** (minor).

- Current `main`: `2.22.0` @ `3743545c`
- Pending SP-*: **0** before authoring (Next Task ID was **SP-768**)
- Open issues: **12** — 0 `documentation`, 0 `bug`, all `enhancement` / epics
- Dep drift: peer `0.87.0`→`0.87.1` (patch only — defer); `npm audit` **0**; Actions still on **v4** / github-script **v7** (#285 Wave C)

Intake snapshot: `spine-tasks/_authoring/release-v2.23.0/intake-snapshot-20260926.md`

**Profile override:** bug floor 0 (no open bugs) — required for thin intake; recorded below.

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 | 2–4 (minor) | PASS |
| Bug fixes | 0 | 3–5 | **PASS with operator override** (no open bugs) |
| Enhancements | 2 | 1–2 (minor) | PASS (#285 Wave C + #283 typing) |
| **Total tasks** | 6 | 10–15 | PASS (under floor OK for thin intake) |

**Profile audit:** PASS with operator override (bug count &lt; 3)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@earendil-works/pi-coding-agent` 0.87.0→**0.87.1** (patch); `eslint` 10.10→10.11 (patch); `typescript` 6.0.3→7.0.2 (major — defer); `@types/node` 22.x→26 (defer); `typebox` 1.3.30→1.3.34 (patch) |
| `npm audit` highs/criticals | **0** |
| Action | **include** #285 Wave C (Actions majors — deferred from v2.21/v2.22); **defer** peer 0.87.1 patch, eslint patch, TypeScript 7, `@types/node` 26 |

### Deps mini-table

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| @earendil-works/pi-coding-agent | 0.87.0 | 0.87.1 | **defer** (same 0.87 minor) |
| typescript | 6.0.3 | 7.0.2 | **defer** (stay 6.x) |
| eslint | 10.10.0 | 10.11.0 | **defer** (same major) |
| typebox | 1.3.30 | 1.3.34 | **defer** |
| @types/node | 22.19.19 | 26.6.3 | **defer** (stay 22.x) |
| Actions checkout/setup-node/upload-artifact | v4 | v7 | **include** SP-768 (#285 Wave C) |
| actions/github-script | v7 | v9 | **include** SP-768 (#285 Wave C) |

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #285 Wave C | enhancement P1 | SP-768, SP-769 (gap) | enh + doc | **Select** — Actions majors; Closes #285 |
| #283 | enhancement P2 | SP-770–SP-773 (gap) | enh + doc | **Select** — engine-lanes typing; Closes #283 |
| #284 | enhancement P2 | — | enh | **Defer** — reconcile/doctor typing (Phase 3) |
| #225 / #231 / #43 | epic / P3 | — | epic | **Defer** |
| #212, #211, #209, #135, #127, #124 | P3 | — | enh | **Defer** |
| peer 0.87.1 | hygiene | — | — | **Defer** — patch-only |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-768 | #285 | enh | S | Wave C: bump CI/release/real-pi Actions majors | Partial #285 |
| SP-769 | #285 | doc | S | Document Actions majors + floors | **Closes #285** after SP-768 |
| SP-770 | #283 | enh | M | Type small engine-lanes modules + facade | Partial #283 |
| SP-771 | #283 | enh | M | Type review-* engine-lanes modules | Partial #283; after SP-770 |
| SP-772 | #283 | enh | M | Type matrix/merge engine-lanes modules | **Closes #283**; after SP-771 |
| SP-773 | #283 | doc | S | Document #266 Phase 2 / engine-lanes typing | after SP-772 |

**Release scope ID:** `SP-768,SP-769,SP-770,SP-771,SP-772,SP-773`

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #285 Wave C | enh | SP-768 | create-spine-tasks (lean) |
| #285 Wave C docs | doc | SP-769 | create-spine-tasks (lean); deps SP-768 |
| #283 small modules | enh | SP-770 | create-spine-tasks (lean) |
| #283 review-* | enh | SP-771 | create-spine-tasks (lean); deps SP-770 |
| #283 matrix/merge | enh | SP-772 | create-spine-tasks (lean); deps SP-771 |
| #283 typing docs | doc | SP-773 | create-spine-tasks (lean); deps SP-772 |

---

## Wave plan snapshot (expected)

```text
Wave 0 · SP-768 + SP-770 (parallel — Actions vs typing; disjoint File Scope)
Wave 1 · SP-769 (after 768) + SP-771 (after 770)
Wave 2 · SP-772 (after 771)
Wave 3 · SP-773 (after 772)
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #284 | enh | reconcile/doctor typing — next minor |
| #225 / #231 | epic | Matrix epic remainder |
| #212, #211, #209, #135, #127, #124, #43 | enh/epic | P3 / out of theme |
| peer 0.87.1 / eslint 10.11 / typebox patch | deps | Below include threshold |
| typescript 7 / @types/node 26 | toolchain | Major — defer |

---

## Risks and blockers

- SP-770–772 all touch `tsconfig.batch.json` + `tests/arch/ts-nocheck-guard.test.mjs` — **serialized** via deps to avoid allowlist merge conflicts
- `matrix-run.mjs` / `merge.mjs` are large (LOC policy); type with compact JSDoc / casts; do not grow `PHASE23_GRANDFATHERED_OVER_500`
- release.yml OIDC / github-script gate must still work after github-script **v9** bump (no `require('@actions/github')`)
- Hygiene: `AGENTS.md` / `CLAUDE.md` dirty from GitNexus analyze — commit with packet staging or before Phase 4 preflight

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main` (merges `a01aede1`, `f29761cc`, `49966b25`, `0d3dc628`)
- [x] Post-integrate `release:check` green after each wave (2651/2651 pass each wave)
- [ ] `spine preflight` green
- [x] `npm run release:check` green on final HEAD `0d3dc628` (2651 pass, 89.64% line coverage)
- [ ] CI workflow green on HEAD
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded + stage approved
- [ ] Post-publish smoke
- [x] Every release-scoped Closes CLOSED (#285, #283)

---

## Operator gate

**Awaiting:** explicit **"approve release scope"** before Phase 4 (batch start).
Packets may be authored/committed under Phase 3 while scope approval is pending; **do not** `spine batch start` until this field is `yes`.
