# Release manifest — v2.16.0

**Created:** 2026-08-24
**Current version:** 2.15.0
**Target version:** v2.16.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-08-25)
**Composition choice:** Brutal-audit follow-on + **all three** enhancements (#265, #262, #271) — operator override for enh budget (>2)
**Worker model pin:** `zai/glm-5.3` (activeProfile: `default`) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** yes (2026-08-25, operator `agents.activeProfile` → `allegretto` after quota snapshot showed zai pool 0 tasks / google headroom; recorded before wave 1)
**GitNexus:** refreshed 2026-08-24 — status up-to-date with HEAD (`1729dc3c`)

---

## Context

Operator request: next release after v2.15.0 → **minor → v2.16.0**. Revision: include **#265 + #262 + #271** (larger minor).

- Current `main`: `2.15.0` @ `1729dc3c` (ahead of origin by 1; dirty: `AGENTS.md` / `CLAUDE.md` from GitNexus — restore or commit before preflight)
- Pending SP-*: **0** (696 `.DONE`) — all selected work is **gaps** (SP-720–SP-730)
- Open issues: **3 bugs** (#264, #268, #269) + enhancements; **0** open `documentation`-labeled issues
- Next Task ID: **SP-720** (this release consumes SP-720–SP-730)
- Doctor: advisory quota-risk (#251) on `zai` + escalate `google`; stale worktree `spine-20260802T231234`; `--attached` orphan warn (non-TTY); stale rules-manifest
- Batch state: idle — no active batch

**Intake source:** deferred items from best-of-n brutal audit 2026-08-22 (`9eb77f8e`) / v2.15.0 deferred table.

**Do not reintroduce (v2.12.1–v2.15.0, still binding):**

1. Start Phase 4 without recorded scope approval (F1/#249)
2. Mid-release edit `.spine/spine-config.json` agent pins (F7/#248)
3. Judge `release:check` from log tails alone — verify exit codes (`PIPESTATUS[0]`)
4. Let `main` drift far ahead of `origin` between waves (F8)
5. Use `--attached` from agent/non-TTY shells (#163)
6. Treat cancelled / missing CI as green or red — **no signal** (F-C)
7. Skip post-integrate `release:check` between waves
8. Publish without CI green on `HEAD` (#156)
9. Defer closing `Closes #NNN` until publish — close after each land (§4.3c)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 | 2–4 | PASS |
| Bug fixes | 3 (#264, #268, #269) | 3–5 | PASS |
| Enhancements | 3 (#265, #262, #271) | 1–2 | **WARN — operator override** |
| **Total tasks** | 11 | 10–15 | PASS |

**Profile audit:** PASS with operator override (enhancement count 3 > 2 — operator chose “include all three”)

---

## Intake table

| Issue # | Labels | Mapped SP-* | Bucket | Profile fit | Notes |
|---------|--------|-------------|--------|-------------|-------|
| — | — | SP-720 | doc | minor ✓ | Post-mortem v2.15.0 + follow-on context |
| — | — | SP-721 | doc | minor ✓ | Contract `testCommand` vs gate evidence docs |
| #264 | bug P1 | SP-722 | bug | minor ✓ | Global batch-state lock |
| #268 | bug P2 | SP-723 | bug | minor ✓ | Harden contract testCommand |
| #269 | bug P2 | SP-724 | bug | minor ✓ | File-scope overlap brace/ext probes |
| #265 | enh P1 | SP-725 | enh | minor ✓ | Separate review attempt caps — **before** #262 |
| #262 | enh P1 | SP-727–SP-730 | enh | override ✓ | Split L → 4 S packets; serialize on `review.mjs` |
| #271 | enh P2 | SP-726 | enh | override ✓ | Set dedup — **after** SP-724 |
| #266–#270 | enh P2 | — | — | defer | ts-nocheck, import-cycle, fake-async |
| #225, #229–#232 | epic/enh | — | — | defer | Matrix job arrays |
| #209–#212, #124, #127, #135, #43 | enh P3 | — | — | defer | Low priority backlog |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-720 | — | doc | S | Post-mortem v2.15.0 + release follow-on context | `docs/release/post-mortem-v2.15.0.md` |
| SP-721 | #268 (Partial) | doc | S | Docs: contract testCommand vs gate evidence hardening | Docs companion to SP-723 |
| SP-722 | #264 | bug | M | Global inter-process lock for batch-state writers | `state-io.mjs` + lock helper — Closes #264 |
| SP-723 | #268 | bug | S | Harden contract testCommand (metachar reject) | `contract-exec.mjs` — Closes #268 |
| SP-724 | #269 | bug | S | File-scope overlap: brace globs + ext probes | `file-scope.mjs`, analyze — Closes #269 |
| SP-725 | #265 | enh | S | Separate maxCodeReviewAttempts / maxPlanReviewAttempts | Caps **before** review split — Closes #265 |
| SP-726 | #271 | enh | S | Replace O(N²) includes()-in-loop dedup with Set | After SP-724 — Closes #271 |
| SP-727 | #262 (Partial) | enh | S | Extract `review-poll.mjs` from review.mjs | Foundation for phase split |
| SP-728 | #262 (Partial) | enh | S | Extract `review-stub.mjs`; pass stub queues via params | No `process.env` stub mutation |
| SP-729 | #262 (Partial) | enh | S | Extract `review-code.mjs` + `review-final.mjs` | Phase modules |
| SP-730 | #262 | enh | S | Extract `review-plan.mjs`; thin coordinator; ≤500 LOC | Closes #262 |

**Release scope ID:** `SP-720,SP-721,SP-722,SP-723,SP-724,SP-725,SP-726,SP-727,SP-728,SP-729,SP-730`

**Dependencies:**

- SP-726 → SP-724 (shared `src/tasks/analyze/index.mjs`)
- SP-727 → SP-725 (`review.mjs` — caps land first)
- SP-728 → SP-727
- SP-729 → SP-728
- SP-730 → SP-729
- Others: none

**Suggested waves:**

```text
Wave 0: SP-720, SP-721, SP-723, SP-725   # docs + contract harden + review caps
Wave 1: SP-722, SP-724                   # batch-state lock (M) + file-scope analyze
Wave 2: SP-727, SP-726                   # review-poll extract + Set dedup (disjoint files)
Wave 3: SP-728, SP-729                   # stub + code/final extract (serial via deps; one lane)
Wave 4: SP-730                           # plan extract + thin coordinator; Closes #262
```

Note: SP-728→SP-729→SP-730 are a **serial chain** on `review.mjs`. Plan may pack them across waves 3–4; do not parallelize those three.

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-720 SP-721 SP-722 SP-723 SP-724 SP-725 SP-726 SP-727 SP-728 SP-729 SP-730
spine plan SP-720,SP-721,SP-722,SP-723,SP-724,SP-725,SP-726,SP-727,SP-728,SP-729,SP-730
spine run sequence SP-720,SP-721,SP-722,SP-723,SP-724,SP-725,SP-726,SP-727,SP-728,SP-729,SP-730 --dry-run
# per wave (detached — omit --attached)
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
| — | doc | SP-720 | create-spine-tasks (lean) |
| #268 (docs slice) | doc | SP-721 | create-spine-tasks (lean) |
| #264 | bug | SP-722 | create-spine-tasks (lean) |
| #268 | bug | SP-723 | create-spine-tasks (lean) |
| #269 | bug | SP-724 | create-spine-tasks (lean) |
| #265 | enh | SP-725 | create-spine-tasks (lean) |
| #271 | enh | SP-726 | create-spine-tasks (lean) |
| #262 | enh | SP-727–SP-730 | create-spine-tasks (lean) — 4-way split |

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #266 | enh P2 | @ts-nocheck burn-down — multi-phase |
| #267 | enh P2 | engine-lanes import cycle — benefits from #262 but out of this release |
| #270 | enh P2 | fake-async removal — 8 functions across modules |
| #225, #229–#232 | epic/enh | Matrix job-array follow-ons |
| #209–#212, #124, #127, #135, #43 | enh P3 | Low priority / experimental |

---

## Risks and blockers

- **Enhancement override:** 3 enhancements vs profile 1–2 — operator explicit; record in final report
- Worker pin `zai/glm-5.3` — quota-risk advisory (#251); **do not** thrash pins on 429/403
- SP-722 is **M** — keep wave 1 to ≤2 tasks
- SP-725 → SP-727…SP-730 serial on `review.mjs` — 5-wave release; longer cycle
- SP-724 → SP-726 serialize on analyze
- Hygiene before Phase 4: clean `AGENTS.md`/`CLAUDE.md`, optional `spine rules sync`, optional stale worktree cleanup
- Unpushed commit on `main` (`1729dc3c`) — push after first green land (or before wave 0 if tree clean)

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] CI workflow green on `HEAD` (release-safe profile)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
- [ ] All release-scoped `Closes #NNN` CLOSED on GitHub
