# Release manifest — v2.18.0

**Created:** 2026-08-30
**Current version:** 2.17.0
**Target version:** v2.18.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-08-30)
**Composition choice:** Bugs #272–#275 + enh #276 + 2nd enh #232 (matrix LLM PROMPT substitution). Docs override: 0 standalone (deltas inside #274/#275/#276/#232 runbook).
**Worker model pin:** `zai/glm-5.3-flash` via `agents.activeProfile: default` (doctor effective pin; top-level `agents.worker` is `kimi-coding/k3` but inactive under default) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**GitNexus:** refreshed 2026-08-30 — status up-to-date with HEAD (`528f2fd`)

---

## Context

Operator request: **next minor** after v2.17.0 → **v2.18.0**.

- Current `main`: `2.17.0`, clean, synced with `origin/main` (`528f2fd`)
- Pending SP-*: **0** — all discovered tasks `.DONE` on disk (Next Task ID **SP-737**)
- Open issues: **4 bugs** (#272–#275), **0 documentation**, **14 enhancements**
- Doctor: advisory quota-risk (#251) on escalate/hard pins; stale worktree `spine-20260802T231234`; `--attached` orphan warn (non-TTY) — use detached batches
- Batch state: idle — no active batch

**Composition theme:** Operator land-loop reliability cluster from pi-smart-router batch `20260829T074158-00ea` (stall false-negative, timeout false-positive, salvage dead-end, stale-gate wedge) + one prevention enhancement (worker foreground verification).

**Do not reintroduce (v2.12.1–v2.17.0, still binding):**

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
| Documentation | 0 standalone (runbook + worker-prompt docs land inside #274/#275/#276/#232) | 2–4 | **PASS with operator override** (2026-08-30) |
| Bug fixes | 4 (#272–#275) | 3–5 | PASS |
| Enhancements | 2 (#276, #232) | 1–2 | PASS |
| **Total tasks** | 6 (provisional; may split #272/#275 if >4 impl steps) | 10–15 | PASS (under target, within cap) |

**Profile audit:** PASS with operator override for **0 standalone documentation** items (doc deltas ship inside bug/enh packets).

---

## Intake table

| Issue # | Labels | Mapped SP-* | Bucket | Profile fit | Notes |
|---------|--------|-------------|--------|-------------|-------|
| #272 | bug | SP-737 (gap) | bug | minor ✓ | Stall watchdog ignores static-null progress |
| #273 | bug | SP-738 (gap) | bug | minor ✓ | Timeout fails task despite `.DONE` |
| #274 | bug | SP-739 (gap) | bug | minor ✓ | `salvage --integrate` needs gate open path |
| #275 | bug | SP-740 (gap) | bug | minor ✓ | Stale-gate reopen vs phase=completed + runbook §5.2 |
| #276 | enh | SP-741 (gap) | enh | minor ✓ | Worker foreground verification guardrail |
| #232 | enh P2 | SP-742 (gap) | enh | minor ✓ | LLM matrix per-row PROMPT substitution |
| #266 | enh P2 | — | — | defer | `@ts-nocheck` burn-down — multi-phase L |
| #229,#230,#231 | enh | — | — | defer | Matrix epic children (#225) |
| #225 | epic | — | — | defer | Matrix job arrays epic |
| #209–#212,#124,#127,#135,#43 | enh P3 / epic | — | — | defer | Low priority / large |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-737 | #272 | bug | M | Stall watchdog must treat static-null progress as non-progress | `worker-heartbeat` / checkpoint signals; SIGSTOP-style repro |
| SP-738 | #273 | bug | S | Honor `.DONE` / doneInLane before classifying worker timeout failure | Runner exit path; post-done grace |
| SP-739 | #274 | bug | S | `salvage --integrate` opens gate when none exists | Escape hatch for pre-merge failures |
| SP-740 | #275 | bug | S | Gate reopen / resume path for phase=completed + runbook §5.2 | Align integrate vs gate status messages |
| SP-741 | #276 | enh | S | Worker prompt: forbid backgrounding long verifications | Optional harness hint on live children |
| SP-742 | #232 | enh | M | LLM matrix rows get per-row PROMPT/contract substitution | `matrix-run.mjs` + helpers; runbook §2.4 |

**Release scope ID:** `SP-737,SP-738,SP-739,SP-740,SP-741,SP-742`

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #272 | bug | SP-737 | create-spine-tasks (lean) |
| #273 | bug | SP-738 | create-spine-tasks (lean) |
| #274 | bug | SP-739 | create-spine-tasks (lean) |
| #275 | bug | SP-740 | create-spine-tasks (lean) |
| #276 | enh | SP-741 | create-spine-tasks (lean) |
| #232 | enh | SP-742 | create-spine-tasks (lean) |

---

## Wave plan snapshot

```text
Spine plan — ids
6 task(s) · 3 wave(s) · maxParallel 4

Wave 0 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-737 — Stall watchdog treats static-null progress as non-progress
  Lane 2: SP-739 — salvage --integrate opens gate when none exists
  Lane 3: SP-741 — Worker prompt: foreground long verifications

Wave 1 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-738 — Honor .DONE before classifying worker timeout failure
  Lane 2: SP-740 — Gate reopen for completed phase + runbook §5.2

Wave 2 · 1 task
  Lane 1: SP-742 — LLM matrix rows get per-row PROMPT substitution
```

Start: `spine batch start SP-737,SP-738,SP-739,SP-740,SP-741,SP-742 --wave 0`

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #266 | enh P2 | Multi-phase typecheck burn-down — too large for this minor |
| #229 | enh P2 | Matrix env + maxParallel — epic child |
| #230 | enh P2 | Per-row matrix status/retry — depends on #225 scheduling |
| #231 | enh P3 | Matrix maxFailedIndexes |
| #225 | epic | Matrix job arrays — out of minor |
| #212,#211,#209,#135,#127,#124,#43 | enh P3 / epic | Below P2 / epic scope |

---

## Risks and blockers

- #272/#273 may share stall/timeout code paths — may need same-wave serialization or sequential waves
- #274/#275 both touch gate/integrate recovery — serialize if file scopes overlap
- Doctor quota-risk advisory (#251) — advisory only; pin stays `kimi-coding/k3` for this release
- 0 open documentation issues → profile WARN; override requested below
- All work is **gaps** — Phase 3 authoring required before Phase 4

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
- [ ] Every release-scoped `Closes #NNN` CLOSED (§4.3c + Phase 6 sweep)
