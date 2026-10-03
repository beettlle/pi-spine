# Release manifest — v2.26.0

**Created:** 2026-09-27
**Current version:** 2.25.0
**Target version:** v2.26.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-09-27 — scope enumerated in the operator invocation: "State and lock work: #301 together with #293, then #302. Rest of P1: #304, #305, #307, #299 as well as #293"; same precedent as v2.25.0)
**Composition choice:** Batch-state lock / write-path correctness from epic [#324](https://github.com/beettlle/pi-spine/issues/324) first (#301 with #293 in waves 1–2, #302 in wave 3), remaining P1s in parallel lanes. #293 is fixed in wave 1 because it recurred throughout the v2.25.0 land loops.
**Worker model pin:** `zai/glm-5.3` via `agents.activeProfile=hard` (config commit `d138142c`, pinned in `fc8558f9`) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** yes — 2026-10-02, operator-approved: z.ai weekly limit exhausted (code 1310, resets 2026-10-06 01:01 UTC+8). Worker switched to `kimi-coding/k3` (thinking high) via `agents.activeProfile=allegretto` for SP-796, SP-797, SP-802, SP-803. Reviewer (`google/gemini-3.1-pro-preview`) and supervisor (`google/gemini-3.5-flash-lite`) unchanged. `escalatePolicy.toProfile` still points to `hard` (GLM, out of quota). Restore `activeProfile=hard` before v2.27.
**GitNexus:** refreshed 2026-09-27 — status up-to-date with HEAD (`258f2a7`)

---

## Pre-authoring notes

Seeded before Phase 1 intake so the worker pin is decided before any v2.26 batch starts.

- **Why GLM-5.3 for this release:** the planned v2.26 work is the batch-state lock, compare-and-swap and journal fixes from epic [#324](https://github.com/beettlle/pi-spine/issues/324) (#301 with #293, #302, then the remaining P1s). The escalation profile `hard` now uses `zai/glm-5.3`, reviewed by `google/gemini-3.1-pro-preview` for plan, code and final review.
- **Escalation during this release:** none available — `escalatePolicy.toProfile` is `hard`, which is already active. Escalate only on content or contract failure, and record any override above before applying it.
- **v2.27 authoring:** switch back with `spine settings set agents.activeProfile default` before the first v2.27 batch, and record the default-profile worker pin (`zai/glm-5.3-flash`) in the v2.27 manifest.

---

## Context

- Current `main`: `2.25.0` @ `258f2a7` (v2.25.0 on npm)
- Pending SP-*: **0** before authoring (Next Task ID was **SP-790**; now **SP-804**)
- Open issues: **38** — 0 `documentation`; P1 bugs #299, #301, #302, #304, #305, #307; unprioritized bugs #293, #294; P2/P3 backlog; epic #324
- `spine status --diagnose`: idle

### Authoring constraints

- `BATCH_MODULE_LOC_LIMIT = 500` on top-level `src/batch/*.mjs` (empty grandfather list). Near-cap files touched this release: `contract-exec.mjs` 498 (SP-799 moves a helper out; SP-800 must stay ≤ 500), `resume.mjs` 498 (SP-798 adds one argument), `lifecycle.mjs` 469 (SP-792, SP-796). `src/batch/engine-lanes/*` is not counted.
- `withBatchStateLock` is re-entrant per process via a `globalThis` map; SP-797's async variant keeps the locked section synchronous so re-entrancy stays correct.

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 | 2–4 (minor) | WARN — 0 doc issues open; SP-803 documents the operator-visible changes |
| Bug fixes | 7 issues / 13 packets | 3–5 | **PASS with operator override** (operator enumerated 7 bugs) |
| Enhancements | 0 | 1–2 (minor) | PASS with operator override (bug-only release by operator choice) |
| **Total tasks** | 14 | 10–15 | PASS |

**Profile audit:** PASS with operator override (bug count 7 > 5; 0 enhancements; docs under floor)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `typescript` 6.0.3 → 7.0.2 (major); `@types/node` 22.20.4 → 26.6.3 (major). No same-major drift. |
| `npm audit` highs/criticals | **0** |
| Action | **deferred** — toolchain majors fire the minor threshold, but the operator scoped this release to the enumerated bugs; TS 7 migration deserves its own release (same call as v2.25.0) |

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| typescript | 6.0.3 | 7.0.2 | **defer** (major; bug-only scope) |
| @types/node | 22.20.4 | 26.6.3 | **defer** (major) |

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #293 | bug | SP-790 | bug | **Select** — wave 1 (recurring land-loop blocker) |
| #301 | bug P1 | SP-790 (Partial), SP-791 (Partial), SP-792 (Partial), SP-793 (Closes) | bug | **Select** — split: guard / RMW helper / archive snapshot / bypass audit |
| #302 | bug P1 | SP-794, SP-795, SP-796 (Partial), SP-797 (Closes) | bug | **Select** — split: steal race / fsync / critical sections / async wait |
| #304 | bug P1 | SP-798 | bug | **Select** |
| #305 | bug P1 | SP-799 (Partial), SP-800 (Closes) | bug | **Select** — split: async runner / async verify + callers |
| #307 | bug P1 | SP-802 | bug | **Select** |
| #299 | bug P1 | SP-801 | bug | **Select** |
| — | doc | SP-803 | doc | **Select** — runbook for v2.26.0 behavior changes |
| #294 | bug | — | bug | **Defer** — outside operator scope |
| #309–#323 | P2 | — | bug/enh | **Defer** |
| #324 | epic P1 | — | epic | **Defer** (tracking epic; this release advances it) |
| #225, #231, #212, #211, #209, #135, #127, #124, #43 | P3 | — | enh/epic | **Defer** |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-790 | #293, #301 | bug | M | Refuse post-archive batch-state resurrection | Closes #293; Partial #301 |
| SP-791 | #301 | bug | M | Atomic batch-state update helper; engine/pause merge in lock | Partial #301; deps SP-790 |
| SP-792 | #301 | bug | M | Abort/complete/dismiss archive in-lock state | Partial #301 |
| SP-793 | #301 | bug | M | `bypassOwnerCheck` rename + bypass-site audit | Closes #301; deps SP-790, SP-791 |
| SP-794 | #302 | bug | M | Lock steal-by-rename with token re-check | Partial #302 |
| SP-795 | #302 | bug | S | Durable `writeJsonAtomic` | Partial #302 |
| SP-796 | #302 | bug | M | Shrink terminal lock sections to state I/O | Partial #302; deps SP-792 |
| SP-797 | #302 | bug | M | Async engine lock wait | Closes #302; deps SP-791, SP-793, SP-794 |
| SP-798 | #304 | bug | M | Lane merge out-of-scope fail-closed | Closes #304 |
| SP-799 | #305 | bug | M | Async contract shell runner | Partial #305 |
| SP-800 | #305 | bug | M | Async contract verification | Closes #305; deps SP-799 |
| SP-801 | #299 | bug | S | Worker fails closed when pi is missing | Closes #299 |
| SP-802 | #307 | bug | M | Sequence wait deadline + stall exit | Closes #307; deps SP-798 (shared `defaults.mjs`) |
| SP-803 | — | doc | S | Runbook: v2.26.0 state and lock hardening | deps SP-790, 793, 796, 797, 798, 800, 801, 802 |

**Release scope ID:** `SP-790,SP-791,SP-792,SP-793,SP-794,SP-795,SP-796,SP-797,SP-798,SP-799,SP-800,SP-801,SP-802,SP-803`

### Operator wave plan (explicit scope per wave)

The planner would put every no-dependency task (including #302's SP-794/795) in wave 0. Waves run as explicit scope lists instead, to honor the operator order (#301 + #293 → #302) and keep ≤ 4 M tasks per wave:

| Wave | Scope | Rationale |
|------|-------|-----------|
| 1 | `SP-790,SP-798,SP-799,SP-801` | #293 guard (#301 part 1) + #304, #305 runner, #299 |
| 2 | `SP-791,SP-792,SP-793,SP-800` | Finish #301 (SP-793 runs after SP-791 inside the batch) + #305 async verify |
| 3 | `SP-794,SP-795,SP-796,SP-797` | #302 (SP-797 runs after SP-794 inside the batch) |
| 4 | `SP-802,SP-803` | #307 + docs (SP-803 last) |

---

## Gaps requiring new packets

All 14 packets are new (lean authoring). See Selected tasks.

---

## Wave plan snapshot

`spine tasks validate` (14): 14 passed, 0 failed. `spine tasks analyze` (14): 0 blocking, 2 warnings (whole-scope wave 0 has 5 M tasks — handled by per-wave scopes; pre-existing missing `_explore/engine-lanes-split/findings.md`). Two blocking overlaps found on first analyze (SP-798/SP-802 on `src/config/defaults.mjs`, SP-793/SP-797 on `src/batch/pause.mjs`) were fixed with serialization edges.

```text
spine plan SP-790,SP-798,SP-799,SP-801
Wave 0 · 4 tasks · 4 lanes in parallel
  Lane 1: SP-790 — Refuse post-archive batch-state resurrection
  Lane 2: SP-798 — Lane merge: never silently discard lane-committed out-of-scope changes
  Lane 3: SP-799 — Async shell runner for contract commands (process-group timeout kill, output cap)
  Lane 4: SP-801 — Worker fails closed when pi is missing from PATH (no implicit stub)
```

Waves 2–4 are planned after the previous wave lands (deps must be `.DONE`).

Baseline `npm run release:check` on `258f2a7` (pre-authoring): tests 2709 pass / 0 fail, line coverage 90.03%, exit 0 — log `/tmp/pi-spine-v2.26-baseline.log`.

---

## Execution log

### Wave 1 — batch `20260928T010710-9c1b` (`SP-790,SP-798,SP-799,SP-801`)

- 2026-09-28 01:16–01:18 UTC: all four workers failed with z.ai 429 (5-hour usage limit, reset 10:37:44 UTC+8). Operator chose **wait for reset, then retry** (no pin change, #248). Lane 2 had stray untracked `index.ts` / `parallel.ts` (worker scratch, outside File Scope) — removed before retry.
- 15:26 UTC: `spine batch retry` ×4 + `spine batch resume`. SP-790, SP-799 completed with plan/code/final review and `contract.verified`. SP-798 hit the 429 limit again at 15:58 (reset 2026-09-29 04:26:47 UTC+8 = 20:26 UTC); partial work kept in lane 2.
- **SP-801 completed through a leaked stub verdict**: its contract test run (`review.test.mjs`, direct `node --test`) wrote a stub final `PASS` into the live journal; the engine honored it (`honorSource: "journal"`) and skipped contract verification. Filed [#328](https://github.com/beettlle/pi-spine/issues/328). Operator re-ran the SP-801 contract in the lane-4 worktree: lint + typecheck exit 0, 43/43 tests pass; diff reviewed against the packet.
- Mitigation: SP-791–SP-797, SP-800, SP-802 Contract `testCommand` now set `SPINE_SUPPRESS_JOURNAL_ATTACH=1` (Amendments recorded in each PROMPT).
- 21:35 UTC: SP-798 retried after quota reset; completed with plan/code/final review and `contract.verified`. Wave merged 21:57.
- 22:03 UTC: waited for `gate.evidence_completed` before approving (avoids #293 on the pre-fix engine). Gate evidence test count (2709) matched the pre-release baseline, so it likely ran against `main`, not orch — verified independently post-integrate.
- Integrated as `92a53711`; `spine batch complete` archived the batch and `.spine/batch-state.json` was not recreated.
- Post-integrate `npm run release:check` on `main`: 2727 pass / 0 fail, line coverage 90.07%, exit 0 — log `/tmp/pi-spine-v2.26-wave1.log`.
- Paused after wave 1 at operator request (peak model pricing). Next: wave 2 `SP-791,SP-792,SP-793,SP-800`.

### Wave 2 — batch `20260930T160832-5a48` (`SP-791,SP-792,SP-793,SP-800`)

- 2026-09-30 16:08 UTC: preflight `prelanded-file-scope` warning for SP-791/SP-793/SP-800 judged a false positive — the must-change files were edited by wave 1, and none of the wave 2 work is on `main` (`updateSpineBatchState` absent, 21 `bypassWriteGuard` sites, `spawnSync`/`sleepSync` still in `contract-exec.mjs`).
- 16:37 UTC: SP-791 and SP-800 failed with z.ai 429 (5-hour limit, reset 2026-10-01 05:08:52 UTC+8 = 21:08 UTC) after ~30 min of 3 GLM-5.3 lanes. Both lanes had verification green and final steps committed; only `.DONE` + engine reviews remain.
- SP-792 completed with plan/code/final review and `contract.verified`; no stub journal events this batch (#328 mitigation held).
- SP-793 not started (depends on SP-791).
- 2026-10-01 17:08 UTC: retry SP-791 + SP-800 after quota reset; both passed contract verification, then final review failed for both at 17:12 with `reviewer exited but produced no artifact` (`final_review_spawn_failed`). No reviewer log was kept.
- 2026-10-02 02:22 UTC: probed `google/gemini-3.1-pro-preview` with `pi -p` (responded); retried SP-791 + SP-800 and resumed. Both final reviews PASS; SP-793 then ran and passed plan/code/final review with `contract.verified`. 0 `"stub":true` journal events (#328 mitigation held).
- 02:53 UTC: waited for `gate.evidence_completed`, then approved. Gate evidence test count (2727) again matched `main`, not orch.
- Integrated as `d631f3d8`; `spine batch complete` archived and `.spine/batch-state.json` was not recreated.
- Post-integrate `npm run release:check` on `main`: 2748 pass / 0 fail, line coverage 90.08%, exit 0 — log `/tmp/pi-spine-v2.26-wave2.log`. `bypassWriteGuard` count in `src`/`tests`: 0; no `spawnSync`/`Atomics` in `contract-exec.mjs`.
- SP-796 amended: `lifecycle.mjs` is 494/500, so `src/batch/lifecycle-cleanup.mjs` added to its File Scope for extracting post-release cleanup.

### Wave 3 — batch `20261002T025919-f11a` (`SP-794,SP-795,SP-796,SP-797`)

- SP-794 and SP-795 completed and merged into orch (`0ec5fe02`, `931386ce`).
- SP-796 failed on the z.ai **weekly** limit (code 1310, resets 2026-10-06 01:01 UTC+8). Lane 3 keeps Step 1 commit `67c5bfaf` plus uncommitted lifecycle edits. SP-797 is not started (depends on SP-796).
- Operator approved switching the worker to `kimi-coding/k3` (see Agent pin override). Probed with `pi -p` (responded), then retried SP-796 and resumed.
- 2026-10-02 16:10 UTC: retry + resume on Kimi. SP-796 passed `contract.verified` (17:04) and completed (17:12; journal shows two `task.completed` events 0.3 s apart — harmless here, worth watching). SP-797 then ran and completed (`contract.verified` 17:54, done 18:02). 0 `"stub":true` journal events (#328 mitigation held).
- 18:08 UTC: waited for `gate.evidence_completed` + `batch.land_loop_finalized`, then approved. Gate evidence test count (2748) again matched `main`, not orch.
- Integrated as `56fecde6`; `spine batch complete` archived and `.spine/batch-state.json` was not recreated.
- First post-integrate `release:check`: plain run 2766/2766, coverage run 2765/2766 — `batch-state-handoff.test.mjs` "runBatchComplete clears active batch-state…" failed in teardown only (`ENOTEMPTY` on `rmdir .git` after all assertions passed). Same class as #223/#233: the file used raw `rm` instead of `destroyGitRepo`. Isolation 6/6 green under coverage; wave 3 complete path is fully synchronous (no new async/spawn in `lifecycle.mjs`/`lifecycle-cleanup.mjs`). Fixed by switching the file's 10 teardowns to `destroyGitRepo`.
- Re-run `npm run release:check` on `main` + fix: 2766 pass / 0 fail (plain and coverage), line coverage 90.12%, exit 0 — log `/tmp/pi-spine-v2.26-wave3.log`.

### Wave 4 — `SP-802,SP-803`

- 2026-10-03 preflight: `git-clean` blocked on the uncommitted `agents.activeProfile=allegretto`. Committed it (workers read config from the main repo root; `.spine/` is not in the npm `files` list). Revert to `hard` after wave 4 lands, before publish.
- `prelanded-file-scope` warning for SP-802 judged a false positive: the only `main` change to `sequence-wait.mjs` / `sequence-detached-poll.test.mjs` since authoring is SP-793's `bypassOwnerCheck` rename; `sequenceMaxWaitMs` / `sequenceStallMs` are absent from `src` and `tests`.
- Batch `20261003T201956-a440`, 20:19 UTC. SP-802 worker finished at 20:41; engine plan review failed at 20:42 with `reviewer exited but produced no artifact` (`plan_review_spawn_failed`, ~10 s reviewer life). Gemini probe with `pi -p` responded; `spine batch retry SP-802` + resume → plan APPROVE, `contract.verified`, final PASS, merged into orch. Occurrence added to [#332](https://github.com/beettlle/pi-spine/issues/332#issuecomment-5973300486). Diagnose had recommended `salvage --integrate`, which would have skipped review.
- SP-803 worker finished at 20:51 (steps committed, `.DONE` written, tracked tree clean) but failed `GitignoredDirtyWorktree` on untracked ignored artifacts in lane 1 (`.pi-smart-router/` model cache, `.pi/loops/`, `coverage-run.tap.log`, `graphify-out/`; same family as #205/#206). No writers alive; `git clean -fdX` in lane 1 (only those four paths ignored), retry + resume.
- **SP-803 completed via `skippedDoneOnDisk` with no engine plan/final review or contract verification** (its first run failed before reviews). Manual verification: contract is `testCommand: true`, `fileScopeMustChange` runbook (changed), `fileScopeMustNotChange` `src/**`/`bin/**` (untouched; its stray `.spine/rules-manifest.json` commit did not reach orch). Every identifier, error string and default in the 28-line runbook subsection was checked against orch source (event names, `outOfScopeMergeAllowList` defaults, `TIMEOUT_GRACE_MS = 2000`, `DEFAULT_SEQUENCE_MAX_WAIT_MS` 24 h / `DEFAULT_SEQUENCE_STALL_MS` 30 min) — all match.
- Gate evidence (2766 tests — `main`, not orch) had 1 failure: `batch-state-lock-async.test.mjs` "event loop keeps running while awaiting a contended lock" (4 heartbeat ticks vs floor 5). Timing flake from SP-797's fixed 500 ms hold: under load the parent observed the holder late. Fixed on `main` (`4138a7bb`): holder keeps the lock until the test releases it (cap 5 s) after `minTicks` heartbeats while the engine waits. 24/24 under 8-way parallel load; mutation check with a blocking lock fails on "engine section ran before the holder was released".
- Waited for `gate.evidence_completed` + `batch.land_loop_finalized`, approved, integrated as `54989646`; `spine batch complete` archived and `.spine/batch-state.json` was not recreated. 0 `"stub":true` journal events.
- `agents.activeProfile` restored to `hard` after wave 4.
- First post-integrate `release:check`: plain run 2768/2769 — `detached-start-orphan-timeout.test.mjs` "persists spawn enginePid before wait on timeout failure path" (`spawned engine should have exited`, `kill(pid, 0)` 30 s after a 50 ms fake engine). Not in the wave 4 diff (`liveness.mjs` untouched); isolation 3/3 pass; likely PID recycling under suite load. Filed [#333](https://github.com/beettlle/pi-spine/issues/333) (deferred).
- Re-run `npm run release:check` on `main`: 2769 pass / 0 fail (plain and coverage), line coverage 90.13%, exit 0 — log `/tmp/pi-spine-v2.26-wave4.log`.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #294 | bug | Outside operator-enumerated scope |
| #309–#323 | P2 | Defer |
| #305 step 5 (matrix `contract.test_retry` parity) | follow-up | Not in #305 acceptance criteria |
| #299 optional `.DONE` `mode: "stub"` | follow-up | Optional in #299 |
| TypeScript 7 / `@types/node` 26 | dep major | Own release |
| #225 / #231 matrix epic | epic | P3 |
| #332 | bug | Reviewer spawn with no artifact — hit in waves 2 and 4; retry workaround |
| #333 | test flake | `detached-start-orphan-timeout` PID liveness under load |

---

## Risks and blockers

- 14 packets with 11 M tasks — above a normal minor; operator override recorded. Planner advises `lanes.stallTimeoutMinutes ≥ 120` for real workers.
- SP-790 tightens the write guard for every phase; batch-meta recovery (#126) must pass `allowArchivedResurrection` — called out in the packet.
- SP-798 makes out-of-scope merge conflicts fail closed; batches that silently relied on the discard will now fail with an actionable message.
- SP-797 converts ~19 engine save sites to `await`; a sync enclosing function is recorded as a blocker rather than widened.
- SP-793 / SP-797 touch many `src/batch` files; each wave's post-integrate `release:check` is the cross-file safety net.

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main`
- [x] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [x] `spine preflight` green
- [x] `npm run release:check` green on final `HEAD` (2769/2769, 90.04% lines via `preversion` on `cc3deb87`)
- [x] CI green on `HEAD` (`0e406610`, run 37154582406)
- [x] `git status` clean
- [x] Operator approved publish bump type: minor (2026-10-03)
- [x] `npm version minor` + `git push && git push --tags` (`v2.26.0` → `cc3deb87`)
- [x] `release.yml` succeeded (run 37155387576); staged package approved (2FA)
- [x] Post-publish smoke per `docs/release/npm-publish.md` (`scripts/post-publish-smoke.sh 2.26.0` OK)
- [x] #293, #299, #301, #302, #304, #305, #307 closed with "Shipped in **v2.26.0**"
