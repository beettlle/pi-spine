# Release manifest — v2.15.0

**Created:** 2026-08-22
**Current version:** 2.14.1
**Target version:** v2.15.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-08-22)
**Composition choice:** A — Brutal-audit hardening (P0/P1 security + reliability)
**Worker model pin:** `kimi-coding/k3` (thinking: high) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** yes (2026-08-22, Kimi quota 403 on SP-716 — `agents.activeProfile` → `hard` / `google/gemini-3.1-pro-preview` for SP-716 retry only; restore `default` after wave 0 land)
**GitNexus:** refreshed 2026-08-22 — status up-to-date with HEAD (`a2da164`)

---

## Context

Operator request: next release after v2.14.1 using spine-release-operator.

- Current `main`: `2.14.1` @ `a2da164` (dirty: `.spine/rules-manifest.json` only — hygiene before batch)
- Pending SP-*: **0** (689 `.DONE`) — all selected work is **gaps** (SP-713–SP-719)
- Open issues: **7** in scope (#257–#261, #263); **18+** deferred (enhancements, matrix epic, P2 backlog)
- Next Task ID: **SP-713** (this release consumes SP-713–SP-719)
- Doctor: advisory quota-risk (#251); stale worktree `spine-20260802T231234`; `--attached` orphan warn (non-TTY)
- Batch state: no active batch

**Intake source:** best-of-n brutal audit 2026-08-22 (`9eb77f8e`) filed issues #257–#271.

**Do not reintroduce (v2.12.1–v2.14.1, still binding):**

1. Start Phase 4 without recorded scope approval (F1/#249)
2. Mid-release edit `.spine/spine-config.json` agent pins (F7/#248)
3. Judge `release:check` from log tails alone — verify exit codes (`PIPESTATUS[0]`)
4. Let `main` drift far ahead of `origin` between waves (F8)
5. Use `--attached` from agent/non-TTY shells (#163)
6. Treat cancelled / missing CI as green or red — **no signal** (F-C)
7. Skip post-integrate `release:check` between waves
8. Publish without CI green on `HEAD` (#156)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 | 2–4 | PASS |
| Bug fixes | 5 (#257–#261) | 3–5 | PASS |
| Enhancements | 1 (#263) | 1–2 | PASS |
| **Total tasks** | 7 | 10–15 | PASS |

**Profile audit:** PASS

---

## Intake table

| Issue # | Labels | Mapped SP-* | Bucket | Profile fit | Notes |
|---------|--------|-------------|--------|-------------|-------|
| — | — | SP-713 | doc | minor ✓ | Post-mortem v2.14.1 + audit context |
| #258 | bug P0 | SP-714 | bug | minor ✓ | Batch ID validation + uniquify |
| #259 | bug P0 | SP-715 | bug | minor ✓ | PID + engineStartedAt liveness |
| #260 | bug P0 | SP-716 | bug | minor ✓ | Unified secret redaction |
| #261 | bug P0 | SP-717 | bug | minor ✓ | Atomic batch-history append |
| #257 | bug P1 | SP-718 | bug | minor ✓ | Salvage after final-review spawn failure |
| #263 | enh P1 | SP-719 | enh | minor ✓ | Wire arch/fs tests into ship gate |
| #264 | bug P1 | — | bug | defer | Pairs with #261; next release |
| #265–#271 | enh/bug P2 | — | — | defer | Follow-on hardening / perf |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-713 | — | doc | S | Post-mortem v2.14.1 + brutal-audit release context | `docs/release/post-mortem-v2.14.1.md` |
| SP-714 | #258 | bug | S | Validate and uniquify batch IDs | `src/batch/state.mjs`, CLI `--batch` paths |
| SP-715 | #259 | bug | S | Engine liveness pairs PID with engineStartedAt | `src/process/liveness.mjs` |
| SP-716 | #260 | bug | S | Unify secret redaction across channels | `src/util/secret-redact.mjs` (new) |
| SP-717 | #261 | bug | S | Atomic batch-history append; no silent wipe | `src/batch/state-io.mjs` |
| SP-718 | #257 | bug | S | Salvage eligible after final-review spawn failure | salvage + diagnose paths |
| SP-719 | #263 | enh | S | Wire tests/arch and tests/fs into npm test | `scripts/coverage-policy.mjs` |

**Release scope ID:** `SP-713,SP-714,SP-715,SP-716,SP-717,SP-718,SP-719`

**Dependencies:** all none (parallel-safe within wave constraints)

**Suggested waves:**

```text
Wave 0: SP-713, SP-714, SP-715, SP-716   # 4 tasks — disjoint hot paths
Wave 1: SP-717, SP-718, SP-719           # state-io + salvage + coverage policy
```

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-713 SP-714 SP-715 SP-716 SP-717 SP-718 SP-719
spine plan SP-713,SP-714,SP-715,SP-716,SP-717,SP-718,SP-719
spine run sequence SP-713,SP-714,SP-715,SP-716,SP-717,SP-718,SP-719 --dry-run
spine batch start SP-713,SP-714,SP-715,SP-716 --wave 0   # detached
# after wave 0 land loop + release:check green:
spine batch start SP-717,SP-718,SP-719 --wave 1   # detached
```

**Regression gate** (after each integrate):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
git push origin main
```

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #258 | bug | SP-714 | create-spine-tasks (lean) — **authored** |
| #259 | bug | SP-715 | create-spine-tasks (lean) — **authored** |
| #260 | bug | SP-716 | create-spine-tasks (lean) — **authored** |
| #261 | bug | SP-717 | create-spine-tasks (lean) — **authored** |
| #257 | bug | SP-718 | create-spine-tasks (lean) — **authored** |
| #263 | enh | SP-719 | create-spine-tasks (lean) — **authored** |

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #264 | bug P1 | Global batch-state lock — pairs with #261; defer to v2.15.1 or v2.16.0 |
| #265 | enh P1 | Review attempt caps — benefits #257; defer (touches review.mjs hot file) |
| #262 | enh P1 | review.mjs split — M-sized; defer |
| #266–#271 | enh/bug P2 | Type burn-down, import cycles, perf — follow-on |
| #225, #229–#232 | epic/enh | Matrix job arrays — out of scope |
| #209–#212, #124, #127, #135, #43 | enh P3 | Low priority backlog |

---

## Risks and blockers

- Worker pin `kimi-coding/k3` — doctor quota-risk advisory (#251); **do not** thrash pins on 429/403
- Seven S tasks in two waves — stay within minor profile; no M/L scope creep
- SP-719 may surface existing import-cycle allowlist failures once arch tests run in CI — fix only if introduced by this change; pre-existing cycle (#267) remains allowlisted
- Stale worktree `spine-20260802T231234` — optional cleanup before batch
- Dirty `.spine/rules-manifest.json` — commit or restore before `spine preflight`

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave**
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` — **verified exit 0**
- [ ] CI workflow green on `HEAD` (`gh run list --workflow ci.yml`)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke: `scripts/post-publish-smoke.sh 2.15.0`
