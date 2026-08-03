# Release manifest — v2.12.2

**Created:** 2026-08-02
**Current version:** 2.12.1
**Target version:** v2.12.2
**Bump type:** patch
**Profile:** patch
**Operator approved scope:** yes (2026-08-02)
**Composition choice:** lean patch + override (2026-08-02)

---

## Context

Post-mortem follow-ups from [`docs/release/post-mortem-v2.12.1.md`](../../../docs/release/post-mortem-v2.12.1.md) (F1/F5–F9 → issues #245–#249).

Operator request: address **#249, #248, #246, #247**, and **#245 strategy** (documented Node/V8 limitation + keep isolation re-verify; **not** full V8 root-cause rewrite).

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 (#249+#248 skill gates; #247 smoke retry docs/script) | 1–2 small | PASS |
| Bug fixes | 1 (#245 strategy docs) | 3–5 | WARN (<3) — operator override |
| Enhancements | 1 (#246 TEST_GLOBS suite-dir guard) | **0** | WARN — operator override |
| **Total tasks** | 4 | 5–8 | PASS |

**Profile audit:** PASS with operator override (enhancements in patch; bug count <3)

**Deferred from issue ACs (explicit):**

- #248 optional doctor/preflight quota-risk signal → next minor
- #245 V8 attribution root-cause (beyond documented strategy) → next minor / dedicated cycle

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-691 | #249 + #248 | doc | S | Release-operator hard gates: scope approval, model-pin stability, ban mid-release agent pin edits | Closes #249; Closes #248 (docs ACs; defer doctor) |
| SP-692 | #245 | bug | S | Document slash-commands V8 full-suite under-report strategy; keep isolation re-verify | Closes #245 (strategy path of AC) |
| SP-693 | #247 | doc | S | Post-publish smoke retry/backoff on ETARGET + optional script | Closes #247 |
| SP-694 | #246 | enh | S | Fail coverage/CI when `tests/<dir>` suite dir missing from TEST_GLOBS | Closes #246 |

**Release scope ID:** `SP-691,SP-692,SP-693,SP-694`

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-691 SP-692 SP-693 SP-694
spine plan SP-691,SP-692,SP-693,SP-694
spine run sequence SP-691,SP-692,SP-693,SP-694 --dry-run
spine batch start SP-691,SP-692,SP-693,SP-694 --wave N   # detached — omit --attached
```

**Regression gate** (after each integrate):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #249 + #248 | doc | SP-691 | create-spine-tasks (lean) |
| #245 | bug | SP-692 | create-spine-tasks (lean) |
| #247 | doc | SP-693 | create-spine-tasks (lean); dep SP-691 (skill Phase 6) |
| #246 | enh | SP-694 | create-spine-tasks (lean) |

---

## Wave plan snapshot (confirmed)

```text
Wave 0 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-691 — Release-operator scope approval and model-pin gates
  Lane 2: SP-692 — Document slash-commands V8 coverage strategy
  Lane 3: SP-694 — Guard TEST_GLOBS covers every tests suite directory

Wave 1 · 1 task
  Lane 1: SP-693 — Post-publish smoke ETARGET retry
```

Serialize SP-691 → SP-693 via `dependencies.json` (shared `skills/spine-release-operator`).

Confirmed via `spine plan SP-691,SP-692,SP-693,SP-694` after authoring.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #248 doctor/preflight quota-risk signal | enh | Optional AC; defer to minor |
| #245 V8 attribution root-cause | bug | Strategy-only this patch; isolation re-verify remains |
| #226 / #228 | bug/enh | Matrix planner redesign — out of this patch |
| Other open enh/epics | enh | Not in operator-selected set |

---

## Risks and blockers

- Do **not** edit `.spine/spine-config.json` agent pins mid-release (this release documents that rule).
- SP-691 and SP-693 share release-operator skill / publish docs — **must serialize**.
- SP-694 touches `scripts/coverage-policy.mjs` + tests — keep disjoint from SP-692 doc-only paths.
- Dirty `main` ahead of origin after waves: push after each land loop when publish is the goal (#249 / F8).

---

## Stabilization / do not reintroduce

Carry forward from v2.12.1:

1. No Phase 4 without recorded "approve release scope"
2. No incomplete helpers labeled shipped
3. No mid-release model-config thrash
4. No large blast-radius merges before publish gates

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main`
- [x] Post-integrate `release:check` green after **each wave** (log: `/tmp/pi-spine-post-integrate-wave-final.log`, exit 0)
- [x] `spine preflight` green
- [x] `npm run release:check` green on final `HEAD` (preversion + CI parity)
- [x] CI workflow green on `HEAD` (`ci.yml` [30775471082](https://github.com/beettlle/pi-spine/actions/runs/30775471082) @ `26c4d60a`; post-tag [30791392837](https://github.com/beettlle/pi-spine/actions/runs/30791392837) @ `8b8697c8`)
- [x] `git status` clean (at bump; rules-manifest drift discarded)
- [x] Operator approved publish bump type: **patch**
- [x] `npm version patch` + `git push && git push --tags` → `v2.12.2` @ `8b8697c8`
- [x] `release.yml` succeeded ([30791394158](https://github.com/beettlle/pi-spine/actions/runs/30791394158))
- [x] Post-publish smoke with ETARGET retry (`scripts/post-publish-smoke.sh 2.12.2` exit 0; log `/tmp/pi-spine-post-publish-smoke-2.12.2.log`)
