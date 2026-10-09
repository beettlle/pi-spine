# Release manifest — v2.27.0

**Created:** 2026-10-03
**Current version:** 2.26.0
**Target version:** v2.27.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-10-03 — operator invocation "create the next v2.27 release … contain #329", then explicit scope selection: bug set #328, #332, #330, #333 + micromatch→picomatch security fix; include the `@earendil-works/pi-coding-agent` 1.0 bump; keep worker pin `hard`; same precedent as v2.25.0 / v2.26.0)
**Composition choice:** #329 quota fallback (7 packets + docs) as the headline enhancement; review-honor and reviewer-spawn hardening (#328, #332) and the mid-review salvage recommendation (#330) as bug fixes; one test flake (#333); dependency hygiene (prod `micromatch` → `picomatch`, dev `pi-coding-agent` 1.0).
**Worker model pin:** `zai/glm-5.3` via `agents.activeProfile=hard` (restored after v2.26.0 wave 4, `0e406610`) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** yes (2026-10-09, quota failover per #329 interim workaround, not escalation — z.ai `1308` 5-hour limit hit all 4 wave-2 workers (resets 2026-10-10 09:44:48 UTC+8). `spine settings set agents.activeProfile allegretto` → worker `kimi-coding/k3` (thinking `high`); reviewer unchanged (`google/gemini-3.1-pro-preview`, `high`). Run-metrics will still record the batch-start model for retried tasks (#325). Restore `agents.activeProfile hard` after the release.)
**Extension override:** yes (2026-10-08 — `pi remove npm:@trevonistrevon/pi-loop` (was 0.7.17) for this release. With pi 1.1.0 and pi-loop loaded, `google/gemini-3.1-pro-preview` at thinking `high` fails first-turn parallel tool calls with `MALFORMED_FUNCTION_CALL`. Repro: 0/2 with pi-loop alone, 3/3 with all other extensions. This did not cause the HTTP 400 (see the pi-headroom line). Model pins unchanged. Reinstall after publish: `pi install npm:@trevonistrevon/pi-loop`.)
**Extension override (pi-headroom):** yes (2026-10-09 — `pi remove npm:pi-headroom` (was 0.1.0) for this release. Its `context` hook round-trips messages through an OpenAI-format bridge whenever compression saves tokens, and drops `toolCall.thoughtSignature`, so Gemini returns HTTP 400 "missing a thought_signature". Upstream: [mslavov/pi-headroom#3](https://github.com/mslavov/pi-headroom/issues/3). Spine-side isolation: [#334](https://github.com/beettlle/pi-spine/issues/334). Confirmed live: lane-1 SP-804 final review with `HEADROOM_URL=http://127.0.0.1:9` (pass-through) returned PASS. Reinstall only after #3 is fixed: `pi install npm:pi-headroom`.)
**Reviewer thinking override:** reverted (2026-10-09 — briefly set `agents.profiles.hard.reviewer` thinking fields to `medium`; it did not fix the 400, so all four are back to `high`.)
**Start constraint:** the z.ai **weekly** limit (code 1310) recorded in v2.26.0 resets **2026-10-06 01:01 UTC+8 (2026-10-05 17:01 UTC)**. Do not start wave 1 before then. Probe with `pi -p --model zai/glm-5.3 "ping"` before `spine batch start`.
**GitNexus:** refreshed 2026-10-03 — status up-to-date with HEAD (`c0ce8ac`)

---

## Context

- Current `main`: `2.26.0` @ `c0ce8ac` (v2.26.0 on npm)
- Pending SP-*: **0** before authoring (Next Task ID was **SP-804**; now **SP-819**)
- Open issues: **36** — 0 `documentation`; bugs #294, #309–#311, #313–#316, #319, #327, #328 (P1), #330–#333; enhancements #317, #318, #320–#326, #329; epics #324, #225, #43
- `spine status --diagnose`: idle; `spine doctor`: all checks passed (quota-risk advisory on `zai` pin — no live headroom evidence)

### Authoring constraints

- `BATCH_MODULE_LOC_LIMIT = 500` counts `split(/\r?\n/).length` on top-level `src/batch/*.mjs`. At the cap: `engine-lanes.mjs` (500 by that count), `reconcile-batch.mjs` (500), `contract-exec.mjs` (499 `wc -l`), `resume.mjs` (499). Packets touching these keep net line change ≤ 0 and put new logic in `src/batch/engine-lanes/*` (not counted) or new modules.
- Worker failure runs through two paths: `runNonMatrixTaskOnLane` (`engine-lanes.mjs` ~312-378) and `resume-multi-lanes.mjs` ~309-350. Both call `runWorker` (`worker-host.mjs`), which is where #329 classification and the sticky profile override live.
- No in-engine auto-retry exists today; `resetTaskForRetry` (`state.mjs`) is CLI-only and does not touch the lane worktree.
- Contract `testCommand`s keep `SPINE_SUPPRESS_JOURNAL_ATTACH=1` (v2.26 #328 mitigation) until SP-812/SP-813 land.

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 (SP-811, covers SKILL + runbook) | 2–4 (minor) | WARN — 0 doc issues open; one packet documents #329 policy and the v2.27 operator-visible changes |
| Bug fixes | 5 issues-equivalent / 6 packets (#328 ×2, #332, #330, #333, security) | 3–5 | PASS (security-high dep fix inserted in the bug slot per intake checklist) |
| Enhancements | 2 (#329 ×7 packets, pi-coding-agent 1.0) | 1–2 (minor) | PASS |
| **Total tasks** | 15 | 10–15 | PASS (at cap) |

**Profile audit:** PASS with operator override (docs under floor; operator-selected scope fills the 15-task cap)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@earendil-works/pi-coding-agent` 0.87.1 → 1.0.1 (major; installed pi is 1.0.0); `typescript` 6.0.3 → 7.0.2 (major); `@types/node` 22.20.4 → 26.6.4 (major); `eslint` 10.11.0 → 10.12.0; `globals` 17.12.0 → 17.13.0 |
| `npm audit` highs/criticals | **3 high** — `braces` ≤3.0.3 (GHSA-vfj7-8cjw-p6xm, **no patched version**) via prod dep `micromatch` 4.0.8; `brace-expansion` 4.0.0–5.0.11 via dev `minimatch` (eslint, pi-coding-agent; 5.0.12 fixes) |
| Action | **include SP-817** (replace `micromatch` with `picomatch`; refresh lockfile so `brace-expansion` ≥5.0.12) and **include SP-818** (pi-coding-agent devDep ^1.0.1, operator-approved). TS 7 / `@types/node` 26 deferred (own release). eslint/globals same-major drift: folded into SP-818 lockfile refresh only if `npm install` pulls them within existing ranges; no range edits. |

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| micromatch (prod) | 4.0.8 | 4.0.8 | **include** SP-817 — remove; `picomatch` replaces `isMatch` (identical semantics: `micromatch.isMatch` = `picomatch(patterns, opts)(str)`) |
| brace-expansion (dev transitive) | 5.0.9 | 5.0.12 | **include** SP-817 lockfile refresh |
| @earendil-works/pi-coding-agent (dev) | 0.87.1 | 1.0.1 | **include** SP-818 — explore found no removed/renamed symbols we import |
| typescript | 6.0.3 | 7.0.2 | **defer** (major; own release) |
| @types/node | 22.20.4 | 26.6.4 | **defer** (major) |
| eslint / globals | 10.11 / 17.12 | 10.12 / 17.13 | **defer** (same-major; no slot) |

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #329 | enh P2 | SP-804–SP-810 (Partial), SP-811 (Closes) | enh | **Select** — operator headline |
| #328 | bug P1 | SP-812 (Partial), SP-813 (Closes) | bug | **Select** — test/env isolation + engine honor hardening |
| #332 | bug | SP-814 (Closes; Partial #294) | bug | **Select** — hit in v2.26 waves 2 and 4 |
| #330 | bug P2 | SP-815 | bug | **Select** — v2.26 wave 4 diagnose recommended salvage mid-review |
| #333 | bug | SP-816 | bug | **Select** — v2.26 post-integrate flake |
| — (audit) | security | SP-817 | bug | **Select** — 3 high, prod dep |
| — (drift) | dep | SP-818 | enh | **Select** — operator approved |
| — | doc | SP-811 | doc | **Select** — #329 policy + v2.27 runbook |
| #331, #294 | bug | — | bug | **Defer** — post-hoc Step 0 plan review; #294 item 3 partially addressed by SP-814 |
| #309–#311, #313–#316, #319, #327 | bug P2/P3 | — | bug | **Defer** — bug slot full |
| #317, #318, #320–#323, #325, #326 | enh P2 | — | enh | **Defer** — enh slot full (#325 overlaps SP-808 "model actually used" for fallback only) |
| #324 | epic P1 | — | epic | **Defer** (tracking) |
| #225, #231, #212, #211, #209, #135, #127, #124, #43 | P3 | — | enh/epic | **Defer** |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-804 | #329 | enh | S | Provider quota error classifier | Partial #329 |
| SP-805 | #329 | enh | M | `agents.quotaFallbackProfile` config + `SPINE_AGENT_PROFILE_OVERRIDE` | Partial #329 |
| SP-806 | #329 | enh | M | Classify worker quota failures (exitReason, run-metrics, journal) | Partial #329; deps SP-804 |
| SP-807 | #329 | enh | S | `decideQuotaFallback` pure decision | Partial #329; deps SP-804 |
| SP-808 | #329 | enh | M | Persist fallback state + sticky worker override + truthful metrics model | Partial #329; deps SP-805, SP-806, SP-807 |
| SP-809 | #329 | enh | M | In-lane automatic quota retry (normal + resume) + stub integration | Partial #329; deps SP-806, SP-808 |
| SP-810 | #329 | enh | M | Operator surface: diagnose + doctor quota fallback | Partial #329; deps SP-805, SP-808 |
| SP-811 | #329 | doc | S | Docs: quota fallback policy + v2.27 runbook | Closes #329; deps all |
| SP-812 | #328 | bug | S | Isolate test/worker commands from the live journal | Partial #328 |
| SP-813 | #328 | bug | M | Engine never honors foreign stub verdicts; contract verify before final honor | Closes #328 |
| SP-814 | #332 | bug | M | Reviewer no-artifact: capture output, keep log, one re-spawn | Closes #332; Partial #294 |
| SP-815 | #330 | bug | S | No `pending_lane_land` while engine alive with running task | Closes #330 |
| SP-816 | #333 | bug | S | Deterministic detached-start orphan-timeout test | Closes #333 |
| SP-817 | — | bug | S | Replace `micromatch` with `picomatch` (braces high) | security |
| SP-818 | — | enh | S | `@earendil-works/pi-coding-agent` devDep ^1.0.1 | deps SP-817 (package.json / lockfile) |

**Release scope ID:** `SP-804,SP-805,SP-806,SP-807,SP-808,SP-809,SP-810,SP-811,SP-812,SP-813,SP-814,SP-815,SP-816,SP-817,SP-818`

### Operator wave plan (explicit scope per wave)

| Wave | Scope | Rationale |
|------|-------|-----------|
| 1 | `SP-804,SP-805,SP-812,SP-815` | #329 foundations (classifier, config) + #328 isolation + #330 |
| 2 | `SP-806,SP-807,SP-813,SP-814` | #329 classification + decision; #328 engine; #332 |
| 3 | `SP-808,SP-816,SP-817,SP-818` | #329 state/override; #333; deps (SP-818 runs after SP-817 inside the batch) |
| 4 | `SP-809,SP-810,SP-811` | #329 retry + operator surface; docs last (SP-811 runs after SP-809/SP-810 inside the batch) |

Release waves 1–4 are operator labels, not `--wave` indices. Each wave's explicit scope plans as its own `Wave 0`, so start it with the task IDs only (`spine batch start <ids>`). Adding `--wave N` selects a wave that does not exist in that scope.

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-804 SP-805 SP-806 SP-807 SP-808 SP-809 SP-810 SP-811 SP-812 SP-813 SP-814 SP-815 SP-816 SP-817 SP-818
spine plan SP-804,SP-805,SP-812,SP-815
spine batch start SP-804 SP-805 SP-812 SP-815    # detached — omit --attached (#163); no --wave flag
spine status --diagnose    # while the engine PID is alive, ignore a salvage recommendation (see below)
spine gate approve && spine integrate && npm install && spine batch complete
npm run release:check 2>&1 | tee /tmp/pi-spine-v2.27-wave1.log; test "${PIPESTATUS[0]}" -eq 0
```

**Salvage while the engine is alive ([#330](https://github.com/beettlle/pi-spine/issues/330)):** until SP-815 lands, `spine status --diagnose` reports `pending_lane_land` and recommends `spine batch salvage … --integrate` while the engine is still running or reviewing a task. Do not salvage while `Engine PID … still running` appears. Wait with `spine wait`, and salvage only after the batch phase is terminal and the lane work is confirmed unreviewed or failed.

**Model pin policy ([#248](https://github.com/beettlle/pi-spine/issues/248)):** one worker pin (`hard`). Record any override above **before** applying. Quota failures are not grounds for escalation; until SP-809 lands, the interim workaround in #329 applies (record override → `spine settings set agents.activeProfile allegretto` → retry).

---

## Gaps requiring new packets

All 15 packets are new (lean authoring). See Selected tasks.

---

## Wave plan snapshot

```text
(paste spine plan output after Phase 3 validate/analyze)
```

---

## Execution log

- **2026-10-08 wave 1, attempt 1** — batch `20261009T012828-2d7d` (`SP-804 SP-805 SP-812 SP-815`, z.ai probe `pong` beforehand). All 4 workers finished, but all 4 tasks failed at engine plan review with `plan_review_spawn_failed`: the Gemini reviewer got HTTP 400 for a missing `thought_signature`, caused by pi-loop under pi 1.1.0. All 4 lanes have `.DONE` and lane commits (`pending_lane_land`, #291 shape). Applied the extension override above; the reviewer probe then passed 5 of 6 runs (the 1 failure was an extension load right after removal, not `MALFORMED_FUNCTION_CALL`). Recovery path pending operator choice.
- **2026-10-09 wave 1 recovery** — operator chose manual final review per lane, then salvage. Contract `testCommand` passed in all 4 lanes (SP-804 30/30, SP-805 69/69, SP-812 51/51, SP-815 63/63) and every `fileScopeMustChange` path is in the lane diff. Lane-1 `spine review step --step 4 --type final` spawn-failed with the same HTTP 400 (`final-20261009T174959.md`). Applied the reviewer thinking override above; the re-run at `medium` failed the same way (`final-20261009T180454.md`).
- **2026-10-09 root cause** — pi-headroom drops `thoughtSignature` when it compresses context (see the pi-headroom override above). With headroom in pass-through, lane-1 SP-804 final review returned PASS (`final-20261009T201501.md`, thinking `medium`). Removed pi-headroom, reverted reviewer thinking to `high`, filed [#334](https://github.com/beettlle/pi-spine/issues/334).
- **2026-10-09 wave 1 landed** — manual `spine review step --type final` at thinking `high`: SP-804 PASS (`final-20261009T201614.md`), SP-805 PASS on attempt 2 (`final-20261009T201858.md`), SP-812 PASS (`final-20261009T202004.md`), SP-815 PASS on attempt 2 (`final-20261009T202239.md`). Both retries were the reviewer writing `APPROVE` instead of `PASS` on a final review; the parser correctly failed closed. Salvaged lanes 1–4 (gate approved after salvage evidence: 2769/2769 tests, typecheck clean). The lane `.DONE` markers were untracked because the engine's post-review step never ran, so they were committed on each lane branch and salvaged a second time. `spine batch complete` archived the batch. `npm run release:check` green: 2805/2805 tests, line coverage 89.10% (`/tmp/pi-spine-v2.27-wave1.log`).
- **2026-10-09 wave 2, attempt 1** — batch `20261009T204506-b6fa` (`SP-806 SP-807 SP-813 SP-814`, pi-headroom and pi-loop absent, z.ai probe `pong`). After ~30 min all 4 workers failed with z.ai `429 1308` (5-hour limit). Lane state: SP-806 3 commits, SP-807 0 commits + uncommitted work, SP-813 2 commits + uncommitted work, SP-814 3 commits (Steps 1–3). Kimi probe `pong`. Applied the agent pin override above; partial lane work checkpointed on each lane branch, then retried in the same lanes.
- **2026-10-09 wave 2 landed** — Kimi (`kimi-coding/k3`) retry, same batch. Engine reviews: SP-814 plan/code APPROVE + final PASS, SP-807 plan APPROVE + final PASS, SP-806 plan/code APPROVE + final PASS. SP-813 failed `plan_review_spawn_failed` (`reviewer exited but produced no artifact`, the #332 shape — SP-814's re-spawn fix is not in the installed engine yet); Contract `testCommand` 58/58, `fileScopeMustChange` paths in the lane diff, manual final review PASS (`final-20261009T233022.md`). Journal shows three `batch.state_write_rejected` `{ reason: stale_engine_pid }` events, each followed by a duplicate `task.completed` for SP-814/807/806; no state loss observed. Salvaged lanes 1–3 (`ef559d54`, `d60b1717`, `292dec18`). Lane 4 conflicted only on the `.spine/rules-manifest.json` `generatedAt` timestamp; took `main`'s copy on the lane branch (`647c8527`) and re-salvaged (`988620d9`). `spine batch complete` archived the batch. First `release:check` failed 2/2838: merged `src/batch/review-step-run.mjs` was 541 LOC (>500 phase23-exit cap); extracted the SP-814 re-spawn helpers to `src/batch/review-spawn-retry.mjs` (`e934b5fd`, no behavior change). `npm run release:check` green: 2838/2838 tests, line coverage 90.37% (`/tmp/pi-spine-v2.27-wave2.log`).
- **2026-10-09 wave 3 started** — batch `20261009T235157-cb46` (`SP-808 SP-816 SP-817 SP-818`; internal waves: SP-808/816/817, then SP-818). pi-headroom and pi-loop absent, preflight passed, worker `kimi-coding/k3` probe `pong`. Preflight's pre-landed warning for SP-808 (`worker-host.mjs`, `metrics.mjs` changed by SP-806) recorded as an operator amendment in the SP-808 PROMPT (`4d1b341e`), together with the 490/500-line cap on `worker-host.mjs`.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #331 | bug | Post-hoc Step 0 plan review verdict; bug slot full |
| #294 | bug | Items 1–2 (plan-review ordering); item 3 via SP-814 |
| #309–#311, #313–#316, #319, #327 | bug | Bug slot full |
| #317, #318, #320–#323, #325, #326 | enh | Enh slot full |
| #329 out-of-scope items | follow-up | Reviewer/supervisor fallback, transient backoff, reset-time scheduling, preflight probing |
| `agents.escalatePolicy.*` not in settings allowlist | follow-up | Schema `suggestedCommand` points at a command that fails today (found during intake) |
| TypeScript 7 / `@types/node` 26 | dep major | Own release |
| Tracked scratch `prev_exec.mjs` / `cur_exec.mjs` at repo root | hygiene | Import `micromatch`; not linted, imported or shipped |

---

## Risks and blockers

- ~~Wave 1 is blocked on the z.ai weekly reset~~ — reset passed; probe returned `pong` on 2026-10-08.
- Reviewer spawns depend on the user pi extension set. Any extension change mid-release must be recorded as an extension override and re-probed with a parallel-tool-call prompt on the reviewer model.
- SP-806 changes worker failure `classification` from `failed` to `provider_quota_exhausted` / `provider_overloaded`; any consumer that matches `"failed"` literally must be found (packet requires an `rg` sweep).
- SP-809 adds the first in-engine automatic retry; it must reuse the same lane worktree and stay within one hop per batch and one auto-retry per task.
- SP-813 tightens the review honor fast path; legitimate `stub: true, honored: true` (`spawn_timeout_with_done`) and relative `artifactPath` events must still honor.
- SP-814 changes reviewer spawn (stdout now drained); every review in every batch passes through it.
- SP-817 swaps the glob engine used by File Scope, contract and rules matching; behavior must be byte-identical (`picomatch` 2.3.x is what `micromatch` already calls).

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD`
- [ ] CI green on `HEAD`
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded; staged package approved (2FA)
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
- [ ] #328, #329, #330, #332, #333 closed
