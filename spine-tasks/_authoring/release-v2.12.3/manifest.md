# Release manifest — v2.12.3

**Created:** 2026-08-03
**Current version:** 2.12.2
**Target version:** v2.12.3
**Bump type:** patch
**Profile:** patch
**Operator approved scope:** yes (2026-08-03)
**Composition choice:** patch + override — #250 + coupled (#226+#228); defer matrix epic children (2026-08-03)
**Worker model pin:** `kimi-coding/k3` (thinking: high) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none

---

## Context

Operator request: address **#226**, **#228**, and **#250**, plus anything else that fits this release.

- Current `main`: `2.12.2` @ `da52f67`, clean, up to date with `origin/main`
- Pending SP-*: **0** (671 `.DONE` on disk) — all selected work is **gaps** (author Phase 3)
- Open bugs: **only #226 and #250** (no open documentation issues)
- `#228` is enhancement P1 and **coupled with #226**: SP-690 reverted SP-689's `buildPlan` matrix propagation in v2.12.1 because the engine could not schedule virtual `SP-X[rowId]` IDs (`task_not_found`). Shipping #226 alone recreates that mismatch.
- Matrix epic children **#229–#232**, epic **#225**, and other enhancements deferred (patch budget; operator chose lean matrix core only)

GitNexus blast radius (pre-authoring):

| Symbol | Risk | Notes |
|--------|------|-------|
| `runCodeReviewPhase` (#250 wire-in) | **HIGH** | Callers: `runTaskOnLane`, `runLaneReviewPhasesBeforeCommit` → resume paths |
| `runMatrixTaskOnLane` (#228) | LOW | Direct caller: `runTaskOnLane` |
| `buildPlan` (#226) | (intake) | Planner packing; must land after engine accepts virtual rows |

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 0 standalone (runbook updates embedded in #226/#228/#250 packets) | 1–2 small | WARN (no open doc issues) |
| Bug fixes | 2 (#250, #226) | 3–5 | WARN (<3) — only two open bugs |
| Enhancements | 1 issue (#228) as **2 S packets** | **0** | WARN — operator override (required companion to #226) |
| **Total tasks** | 4 | 5–8 | PASS |

**Profile audit:** PASS with operator override (enhancement in patch; bug count <3; S-only split of #228)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-695 | #250 | bug | S | Engine-owned `runPlanReviewPhase` after worker `.DONE` | Closes #250; HIGH blast radius — mirror code/final; wire `engine-lanes.mjs` + `resume-lane-reviews.mjs`; honor `agents.reviewer.plan`; align skip/runbook |
| SP-697 | #228 | enh | S | First-class matrix row lane competitors (schedule core) | Partial #228; replace nested parent-held fan-out; rows compete for `lanes.maxParallel`; distinct `laneNumber`/worktree per active row |
| SP-698 | #228 | enh | S | Matrix parent aggregation + #224 hook + supersede SP-690 docs | Closes #228; parent succeeds iff all rows succeed; preserve worktreeSetupHook per row; update runbook; tests for fail-one-row |
| SP-696 | #226 | bug | S | Re-propagate `matrix`/`matrixColumns` through `buildPlan` | Closes #226; **depends on SP-698** (engine schedule + aggregation first); real `buildPlan` regression tests; runbook caveat |

**Release scope ID:** `SP-695,SP-697,SP-698,SP-696`

**Dependencies (author into packets + `dependencies.json`):**

```text
SP-695 — none
SP-697 — SP-695   # serialize shared engine-lanes.mjs hot file
SP-698 — SP-697
SP-696 — SP-698   # engine schedule + aggregation before re-enabling planner virtual rows
```

**Suggested waves:**

```text
Wave 1: SP-695
Wave 2: SP-697 → SP-698 → SP-696
```

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-695 SP-697 SP-698 SP-696
spine plan SP-695,SP-697,SP-698,SP-696
spine run sequence SP-695,SP-697,SP-698,SP-696 --dry-run
spine batch start SP-695,SP-697,SP-698,SP-696 --wave N   # detached — omit --attached
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
| #250 | bug | SP-695 | create-spine-tasks (lean) |
| #228 (schedule core) | enh | SP-697 | create-spine-tasks (lean) |
| #228 (aggregation/docs) | enh | SP-698 | create-spine-tasks (lean); dep SP-697 |
| #226 | bug | SP-696 | create-spine-tasks (lean); dep SP-698; note SP-689/.DONE history + SP-690 revert |

---

## Wave plan snapshot

```text
4 task(s) · 4 wave(s) · maxParallel 4

Wave 0 · 1 task
  Lane 1: SP-695 — Engine-owned plan review phase after worker .DONE

Wave 1 · 1 task
  Lane 1: SP-697 — First-class matrix row lane competitors (schedule core)

Wave 2 · 1 task
  Lane 1: SP-698 — Matrix parent aggregation, #224 hook docs, supersede SP-690

Wave 3 · 1 task
  Lane 1: SP-696 — Re-propagate matrix fields through buildPlan
```

**Analyze:** 0 blocking (CONTEXT missing `_explore/engine-lanes-split/findings.md` warning is pre-existing).

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #225 | epic | Matrix job arrays epic — out of patch; #228 is the P1 slice only |
| #229 | enh | Matrix index env + optional matrixMaxParallel — epic child |
| #230 | enh | Per-row matrix status/retry/cancel — epic child |
| #231 | enh | maxFailedIndexes / success policies — epic child |
| #232 | enh | Complete per-row PROMPT substitution — epic child |
| #238 | enh | Quota pools for anthropic/copilot — unrelated; patch forbids |
| #209–#213, #120, #124, #127, #135, #43 | enh | Backlog — exceed patch profile |

---

## Risks and blockers

- **#250 HIGH risk** on review pipeline — keep SP-695 S-sized; mirror existing code/final patterns; do not change review spawn policy beyond adding plan phase
- **#226+#228 coupling** — never integrate SP-696 alone onto `main` without SP-697 (repeat SP-690 failure mode)
- **SP-689 already `.DONE`** — author SP-696 as a **new** packet that re-applies propagation after engine readiness; do not clear SP-689 `.DONE`
- No additional open bugs to fill the 3–5 bug target without inventing work
- Stale leftover worktree dir `spine-20260802T231234` (doctor warn) — cleanup optional before batch; not blocking

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] CI workflow green on `HEAD` (`gh run list --workflow ci.yml`)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **patch**
- [ ] `npm version patch` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke: `scripts/post-publish-smoke.sh 2.12.3`
