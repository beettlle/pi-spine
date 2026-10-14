# Release manifest — v2.27.1

**Created:** 2026-10-10
**Current version:** 2.27.0
**Target version:** v2.27.1
**Bump type:** patch
**Profile:** patch
**Operator approved scope:** yes (2026-10-14, operator) — 10 tasks including SP-828 as release wave 0. Do not push to `origin` until the release work is done (operator instruction 2026-10-14).
**Composition choice:** #334 (reviewer extension isolation, P1) as the headline bug, split into 4 code packets plus 1 docs packet; #315 (rules-manifest churn that caused a v2.27.0 wave 2 merge conflict) and #314 (gate streak reset fails open, trust decision) as companion bugs. **Added 2026-10-10 (token-cost audit):** #335 (SP-826, worker tail prompt) and #336 (SP-827, execute tasks spawn reviewers) — two S bug fixes that cut per-task worker and reviewer spend; total 9 tasks exceeds the patch cap of 8 (operator override, see Composition audit). **Added 2026-10-11 (stet adoption):** SP-828 refreshes stet (`qwen/qwen3.8-27b` + OpenJev System One critic, contract script counts active findings) and runs as release wave 0 so every v2.27.1 code packet is stet-reviewed; total 10 tasks (operator override).
**Worker model pin:** `zai/glm-5.3-flash` thinking `medium` via `agents.activeProfile=default` (operator, `48e6bc4f`, 2026-10-13). Reviewer unchanged: `google/gemini-3.1-pro-preview` `high` (plan/code/final). `agents.escalatePolicy.toProfile=hard` (`zai/glm-5.3`) is escalation; `agents.quotaFallbackProfile=allegretto` (`kimi-coding/k3`) is provider failover per #329, not escalation. Do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248)).
**Agent pin override:** none
**Extension override:** yes (2026-10-14) — `pi remove npm:@trevonistrevon/pi-loop` for this release (v2.27.0 re-probe still gave 1/2 `MALFORMED_FUNCTION_CALL`). pi-headroom stays as the patched local build (`~/Documents/github/pi-headroom`, branch `fix/preserve-thought-signatures`, `7c203c7`). pi is now 1.2.0 (v2.27.0 ran on 1.1.0). Reviewer probe from the repo root, `pi -p --no-session --model google/gemini-3.1-pro-preview --thinking high "Read package.json and tsconfig.json in parallel (two read tool calls in one turn), then reply with the package name only."`: **3/3** answered `pi-spine` (14 s, 14 s, 19 s), no `MALFORMED_FUNCTION_CALL`, no `thought_signature` 400. Each run printed a pi 1.2.0 loader warning that `pi-smart-router` declares `@earendil-works/pi-ai` in `dependencies` instead of `peerDependencies` (`"*"`); harmless for the probe, not a release blocker. The installed v2.27.0 engine still spawns reviewers with user extensions until SP-819 lands. Reinstall after publish: `pi install npm:@trevonistrevon/pi-loop`.
**GitNexus:** refreshed 2026-10-14 at HEAD `13ea1975` (packet audit)
**Peak-hour policy (operator, 2026-10-14):** do not run GLM workers in z.ai's peak window, 14:00–18:00 UTC+8 = **06:00–10:00 UTC** (23:00–03:00 PDT). Check `date -u` before every `spine batch start` / `resume`. No start or resume after **04:30 UTC**. If a batch is running at **05:00 UTC**, `spine batch pause` (confirm `phase: paused` in `spine status --diagnose`) and let the in-flight worker finish; do not abort. Resume after **10:00 UTC**. Quota fallback to `allegretto` does not lift the pause.

---

## Context

- Current `main`: `2.27.0` @ `13ea1975` (v2.27.0 on npm; local commits not pushed)
- Pending SP-* before authoring: **0** (Next Task ID was **SP-819**; **SP-828** after SP-826/SP-827; now **SP-829** after SP-828)
- Open issues: **33**. 0 `documentation`. Bugs: #334 (P1), #331, #327, #319, #316, #315, #314, #313, #311, #310, #309, #294. Enhancements: #317, #318, #320–#323, #325, #326, plus P3 items. Epics: #324, #225, #43.
- `spine status --diagnose`: idle.

### Authoring constraints

- Top-level `src/batch/*.mjs` batch LOC limit is 500 (`src/config/preflight/loc-capstone.mjs`). At or near the cap: `integrate-worktree.mjs` 498, `engine-lanes.mjs` 498, `journal.mjs` 497, `review-step-run.mjs` 473. `engine-lanes/review-poll.mjs` is 496 (not counted by the policy, kept ≤500 anyway). SP-820 puts new logic in a new module; SP-823's edits to the two 498-line files are net-negative.
- SP-821 partly reverses SP-762 (#291): post-`.DONE` plan-review spawn failures currently route to `pending_lane_land` / salvage on purpose. #334 shows that salvage lands unreviewed code. `spine batch retry <id>` on a finished lane resumes at the review (`review.resumed`), so retry is the re-review path. The #331 caveat (post-hoc plan review can reject finished work) still applies.
- `pi -ne` disables discovered, configured, **and built-in** extensions (pi `docs/cli.md`). Reviewers use only core tools, so SP-819 isolates reviewers only. Worker isolation (#334 item 2) is deferred because workers need the spine worker tools.

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 (SP-825) | 1–2 small | PASS (0 doc issues open; SP-825 documents #334 operator-visible changes) |
| Bug fixes | 5 issues / 8 packets (#334 ×4 code, #315, #314, #335, #336) | 3–5 | PASS |
| Tooling | 1 (SP-828 stet adoption; fixes the contract script's dismissed-finding count) | — | PASS with operator override (2026-10-11) |
| Enhancements | 0 | 0 | PASS (SP-822's doctor check is acceptance criterion 5 of bug #334, not a separate enhancement) |
| **Total tasks** | 10 | 5–8 | **PASS with operator override** — operator chose SP-826 + SP-827 (2026-10-10, token-cost audit); both S, disjoint File Scope, run in release wave 2. Operator added SP-828 (2026-10-11) as release wave 0 so the release is stet-reviewed |
| Task sizes | all S | S only | PASS |
| Dep drift check recorded | yes | WARN if missing | PASS |
| No-code tasks at Review Level 0 | SP-825 (docs; `testCommand` `true`) | all no-code tasks | PASS — `isReviewTypeRequired` returns `false` at level 0, so no plan/code/final reviewer spawns. SP-828 changes scripts, config, and tests, so it stays Level 1 |
| S/M packets without coverage gate or full suite | all 10 | all | PASS (#342; packet audit 2026-10-14) |

**Profile audit:** PASS with operator override (total 10 > cap 8)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@types/node` 22.20.4 → 26.6.5 (major); `typescript` 6.0.3 → 7.0.2 (major); `eslint` 10.11.0 → 10.12.0; `globals` 17.12.0 → 17.13.0; `typebox` 1.3.34 → 1.3.36 |
| `npm audit` highs/criticals | **0** (found 0 vulnerabilities) |
| Action | **deferred** — no security finding; toolchain majors are minor/major-profile only; same-major drift has no slot in a patch release |

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| typescript | 6.0.3 | 7.0.2 | defer (major; own release) |
| @types/node | 22.20.4 | 26.6.5 | defer (major) |
| eslint / globals | 10.11 / 17.12 | 10.12 / 17.13 | defer (same-major; patch has no enh slot) |
| typebox | 1.3.34 | 1.3.36 | defer (patch-level drift outside `^` wanted range; no slot) |

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #334 | bug P1 | SP-819, SP-820, SP-821, SP-822 (Partial), SP-825 (Closes) | bug + doc | **Select** — operator required; v2.27.0 lost hours to it |
| #315 | bug P2 | SP-823 (Closes) | bug | **Select** — test runs dirty the tree; caused the v2.27.0 wave 2 manifest merge conflict |
| #314 | bug P2 | SP-824 (Partial) | bug | **Select** — fail-closed + journaling; streak locking left open |
| #335 | bug P2 | SP-826 (Closes) | bug | **Select** (override) — every worker runs the full suite and receives `worker.md` twice |
| #336 | bug P2 | SP-827 (Closes) | bug | **Select** (override) — execute tasks spawn plan/final reviewers; blocks cheap execute packets |
| — (operator) | tooling | SP-828 | tooling | **Select** (override, 2026-10-11) — stet proven on 27B + OpenJev in the stet repo; v1.5.0 contract script never passes after dismissals |
| #337, #338 | bug P2 | — | bug | **Defer** — rules loader cap (#337) and usage fields (#338); M-sized or design needed |
| #339, #340 | enh P2 | — | enh | **Defer** — worker extension isolation (#339), per-task profile / escalatePolicy (#340); patch allows 0 enh |
| #341 | enh P3 | — | enh | **Defer** — duplicate full-suite runs per wave |
| #342 | docs P2 | — (skills commit on `main`) | doc | **Out of batch** — skill-only docs landed directly; close when `main` is pushed |
| #331 | bug P2 | — | bug | **Defer** — prompt/flow change for post-hoc plan review; M-sized; bug slot full |
| #294 | bug | — | bug | **Defer** — plan-review ordering (items 1–2) |
| #309–#311, #313, #316, #319, #327 | bug P2/P3 | — | bug | **Defer** — bug slot full |
| #317, #318, #320–#323, #325, #326 | enh P2 | — | enh | **Defer** — patch profile allows 0 enhancements |
| #324 | epic P1 | — | epic | **Defer** (tracking) |
| #225, #231, #212, #211, #209, #135, #127, #124, #43 | P3 | — | enh/epic | **Defer** |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-819 | #334 | bug | S | Reviewer spawns pass `pi -ne` by default; `agents.reviewer.loadUserExtensions` opt-out | Partial #334 (AC 1, 2, 6) |
| SP-820 | #334 | bug | S | Classify reviewer provider request errors (`*_review_provider_error`) | Partial #334 (AC 3) |
| SP-821 | #334 | bug | S | Diagnose recommends re-review, not salvage | Partial #334 (AC 4); deps SP-820 |
| SP-822 | #334 | bug | S | Doctor warns about context-rewriting pi extensions | Partial #334 (AC 5); deps SP-819 |
| SP-823 | #315 | bug | S | Idempotent rules manifest sync; drop deprecated merge wrapper | Closes #315 |
| SP-824 | #314 | bug | S | Gate streak reset failure fails closed and is journaled | Partial #314 (locking left open) |
| SP-825 | #334 | doc | S | Docs: reviewer isolation and re-review recovery | Closes #334; deps SP-819–SP-822 |
| SP-826 | #335 | bug | S | Worker tail prompt names Contract testCommand; worker.md sent once | Closes #335; deps SP-828 |
| SP-827 | #336 | bug | S | Execute tasks run at effective Review Level 0 (+ validate warning) | Closes #336; deps SP-828 |
| SP-828 | — | tooling | S | Stet contract review on `qwen/qwen3.8-27b` + OpenJev critic | No deps; SP-819, SP-820, SP-823, SP-824, SP-826, SP-827 depend on it |

**Release scope ID:** `SP-828,SP-819,SP-820,SP-821,SP-822,SP-823,SP-824,SP-825,SP-826,SP-827`

**Stet gating (2026-10-11):** each code packet's Contract ends with `bash scripts/spine-stet-contract-run.sh <level>` — `default` for SP-819, SP-820, SP-821, SP-824, SP-827; `lenient` for SP-822, SP-823, SP-826. SP-825 (docs, `testCommand` `true`) has no stet step. All stet-gated packets list `.review/**` in `fileScopeMustNotChange`.

### Operator wave plan (explicit scope per wave)

| Wave | Scope | Rationale |
|------|-------|-----------|
| 0 | `SP-828` | Stet refresh must be on `main` before any stet-gated Contract runs |
| 1 | `SP-819,SP-820,SP-823,SP-824` | Independent, disjoint File Scope; 2 rounds of 2 lanes at `maxParallel` 2 |
| 2 | `SP-821,SP-822,SP-826,SP-827,SP-825` | SP-821 needs SP-820's exit reasons; SP-822 needs SP-819's key; SP-826/SP-827 depend only on SP-828 and share the first internal wave (2 rounds of 2 lanes at `maxParallel` 2); SP-825 (docs) runs after SP-821/SP-822 inside the batch |

Release waves 1–2 are operator labels. Start each with its task IDs only (`spine batch start <ids>`); each explicit scope plans its own internal waves.

---

## Sequence runner (Phase 4)

Use the checkout CLI (`node bin/spine.mjs`, runbook "PATH / `npm link` / checkout CLI"). The global `/opt/homebrew/lib/node_modules/pi-spine` is a copy dated 2026-10-10, not a link, so it would keep spawning reviewers without `-ne` after SP-819 lands. `sp` below is a shell function for the checkout CLI (works in bash and zsh). Check `date -u` against the peak-hour policy before every `start` / `resume`.

```bash
cd /Users/cdelgado/Documents/github/pi-spine
sp() { node /Users/cdelgado/Documents/github/pi-spine/bin/spine.mjs "$@"; }
export SPINE_STET_NO_AUTO_FINISH=1               # required: engine re-runs the Contract at final review; setup hook runs once per lane
set -o pipefail
sp tasks validate SP-828 SP-819 SP-820 SP-821 SP-822 SP-823 SP-824 SP-825 SP-826 SP-827
stet doctor                                      # before SP-828 lands this reads the old config; check ../stet too (qwen/qwen3.8-27b + System One OK)
sp preflight

# Release wave 0 — stet refresh
date -u; sp batch start SP-828                   # detached — omit --attached (#163)
sp status --diagnose
sp gate approve && sp integrate && npm install && sp batch complete
npm run release:check 2>&1 | tee /tmp/pi-spine-v2.27.1-wave0.log
stet doctor                                      # now reads the SP-828 config (qwen/qwen3.8-27b + System One)

# Release wave 1
date -u; sp batch start SP-819 SP-820 SP-823 SP-824
sp status --diagnose
sp gate approve && sp integrate && npm install && sp batch complete
npm run release:check 2>&1 | tee /tmp/pi-spine-v2.27.1-wave1.log
git status --porcelain                           # must be empty (SP-823: tests no longer rewrite .spine/rules-manifest.json)
rg -n -- '-ne\b' src/batch/review-spawn.mjs      # SP-819 on main; checkout CLI reviewers now run pi -ne

# Release wave 2
date -u; sp batch start SP-821 SP-822 SP-826 SP-827 SP-825
sp status --diagnose
sp gate approve && sp integrate && npm install && sp batch complete
npm run release:check 2>&1 | tee /tmp/pi-spine-v2.27.1-wave2.log
```

Peak window: if a batch is running at 05:00 UTC, `sp batch pause`; after 10:00 UTC, `export SPINE_STET_NO_AUTO_FINISH=1 && sp batch resume`.

**Until SP-821 lands:** if a review spawn fails with `.DONE` in the lane, diagnose still suggests `salvage --integrate`. Do not salvage. Run `spine batch retry <id>` (resumes at the review) or a manual `spine review step --type final` in the lane worktree.

**Model pin policy ([#248](https://github.com/beettlle/pi-spine/issues/248)):** one worker pin (`default`: `zai/glm-5.3-flash`, `medium`). `escalatePolicy` may move a task to `hard`; automatic quota fallback to `allegretto` is allowed (#329); paste the `Agent pin override` line from `spine status --diagnose` above when it fires.

### Execution log

- **2026-10-14 readiness** — Scope approved by the operator. pi-loop removed; reviewer probe 3/3 (see Extension override). Worker probe `pi -p --no-session --model zai/glm-5.3-flash "ping"` → `pong` (8 s). `stet doctor` in pi-spine (pre-SP-828 config): `OpenAI-compatible API OK`, `Model: qwen/qwen3-coder-next`. `stet doctor` in `../stet` (the config SP-828 ports): `OpenAI-compatible API OK`, `Model: qwen/qwen3.8-27b`, `System One OK`, `System One model: openjev-latest`. `lms ps`: `qwen/qwen3.8-27b` loaded, context 65536, parallel 1, idle TTL 1 h. `spine tasks validate` (10 tasks): 10 passed. `spine preflight`: all checks pass except `git-clean` before the readiness commit; one warning, `prelanded-file-scope` for SP-825 (`skills/spine-release-operator/SKILL.md` changed by #342 `f39c87d1`), recorded as an SP-825 amendment with `fileScopeMustChange` unchanged (same handling as SP-808 in v2.27.0). No batch started; `main` not pushed. **Next:** `spine batch start SP-828`.
- **2026-10-14 packet audit** — Commits `5a4b6f28` (packet fixes: `SPINE_STET_NO_AUTO_FINISH=1` required, coverage gates dropped, dot reporter, SP-823/SP-825 scoped checks, SP-828 gitlink check) and `bdf7f6f5` (GitNexus counts). Validate 10/10, analyze 0 blocking, `spine preflight` passed (SP-825 pre-landed warning as above). pi-loop absent; pi-headroom on `fix/preserve-thought-signatures` `7c203c7`; `HEADROOM_URL` unset.
- **2026-10-14 19:22 UTC wave 0 start** — `spine batch start SP-828` with `SPINE_STET_NO_AUTO_FINISH=1` (confirmed in engine env). Batch `20261014T192255-335e`, engine PID 79446. Peak window opens 2026-10-15 06:00 UTC; start cutoff 04:30 UTC.

---

## Gaps requiring new packets

All 10 packets are new (lean authoring, 2026-10-10; SP-826/SP-827 added after the token-cost audit; SP-828 added 2026-10-11).

---

## Wave plan snapshot

Full release scope with SP-828 at `maxParallel` 2 (`spine plan SP-828,SP-819,…,SP-827`, 2026-10-11):

```text
Spine plan — ids
10 task(s) · 4 wave(s) · maxParallel 2

Wave 0 · 1 task
  Lane 1: SP-828 — Stet contract review on qwen3.8-27b with the OpenJev critic

Wave 1 · 6 tasks · 3 rounds (queued by maxParallel)
  Round 1 (2 parallel): SP-819, SP-820
  Round 2 (2 parallel): SP-823, SP-824
  Round 3 (2 parallel): SP-826, SP-827

Wave 2 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-821 · Lane 2: SP-822

Wave 3 · 1 task
  Lane 1: SP-825
```

`spine tasks validate` (10 tasks): 10 passed, 0 failed. `spine tasks analyze`: 0 blocking, 1 pre-existing warning (missing `_explore/engine-lanes-split/findings.md`). `stet doctor` with the target config (stet repo, 2026-10-11): `Model: qwen/qwen3.8-27b`, `System One OK`, `System One model: openjev-latest`. The operator wave plan above keeps SP-826/SP-827 in release wave 2.

Previous snapshot, before SP-828 and at `maxParallel` 4 (`spine plan SP-819,…,SP-827`, 2026-10-10):

```text
Spine plan — ids
9 task(s) · 3 wave(s) · maxParallel 4

Wave 0 · 6 tasks · 2 rounds (queued by maxParallel)
  Round 1 (4 parallel):
    Lane 1: SP-819 — Reviewer spawns skip user pi extensions by default
    Lane 2: SP-820 — Classify reviewer provider request errors as `review_provider_error`
    Lane 3: SP-823 — `spine rules sync` and `npm test` stop rewriting `.spine/rules-manifest.json`
    Lane 4: SP-824 — Gate streak reset failure fails closed and is journaled
  Round 2 (2 parallel):
    Lane 1: SP-826 — Worker tail prompt names Contract testCommand and sends worker.md once
    Lane 2: SP-827 — Execute tasks run at effective Review Level 0

Wave 1 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-821 — Diagnose recommends re-review, not salvage, when a review never ran
  Lane 2: SP-822 — Doctor warns when context-rewriting pi extensions can reach reviewers

Wave 2 · 1 task
  Lane 1: SP-825 — Docs: reviewer extension isolation and review-failure recovery (v2.27.1)
```

The operator wave plan above starts SP-826/SP-827 with release wave 2 instead. Release wave 2 scope at `maxParallel` 2 (`spine plan SP-821,SP-822,SP-826,SP-827,SP-825`, re-run 2026-10-14 after the packet audit):

```text
5 task(s) · 2 wave(s) · maxParallel 2
Wave 0 · 4 tasks · 2 rounds (queued by maxParallel)
  Round 1 (2 parallel): SP-821, SP-822
  Round 2 (2 parallel): SP-826, SP-827
Wave 1 · 1 task
  Lane 1: SP-825
```

Packet audit 2026-10-14: `spine tasks validate` (10 tasks) 10 passed; `spine tasks analyze` 0 blocking, 1 pre-existing warning; full-scope `spine plan` unchanged from the 2026-10-11 snapshot above.

`spine tasks validate`: 9 passed, 0 failed. `spine tasks analyze`: 0 blocking, 1 pre-existing warning (CONTEXT references a missing `_explore/engine-lanes-split/findings.md`).

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #334 item 2 (worker isolation) | follow-up | Tracked as [#339](https://github.com/beettlle/pi-spine/issues/339) (SP-825 closes #334); needs `-ne -e <pi-spine extension>` + tool allowlist |
| [#337](https://github.com/beettlle/pi-spine/issues/337) | bug | Worker rules loader stops at the first oversize rule; drops later rules |
| [#338](https://github.com/beettlle/pi-spine/issues/338) | bug | #208 usage fields never populated (pi text mode; no reviewer rows) |
| [#340](https://github.com/beettlle/pi-spine/issues/340) | enh | Per-task profile/thinking; wire `agents.escalatePolicy` |
| [#341](https://github.com/beettlle/pi-spine/issues/341) | enh P3 | Duplicate full-suite runs per wave (gate evidence + `release:check`) |
| #334 `spine doctor --probe-reviewer` | follow-up | Optional in the issue; spawns a model from doctor |
| #314 streak locking | bug remainder | Read-modify-write lock; left open on #314 |
| #331 | bug | Post-hoc plan review verdict; M-sized |
| #294, #309–#311, #313, #316, #319, #327 | bug | Bug slot full |
| #317, #318, #320–#323, #325, #326 | enh | Patch profile |
| TypeScript 7 / `@types/node` 26 | dep major | Own release |

---

## Risks and blockers

- Stet session lifecycle: without `SPINE_STET_NO_AUTO_FINISH=1`, the worker's passing Contract calls `stet finish`, then the engine's `contract.verified` re-run (and the next task on the same lane, since the setup hook runs once per lane) starts a fresh review from the lane baseline. That review can resurface dismissed findings, include earlier tasks' diffs, and fail with `contract_failed`. Export it for every start and resume.
- Stet-gated contracts need LM Studio (`qwen/qwen3.8-27b`, Enable Thinking off) and OpenJev up for every task. Run `stet doctor` before each wave. If OpenJev is down, export `STET_CRITIC_ENABLED=false` for the batch rather than editing `.review/config.toml`.
- The Contract `testCommand` wall clock is 10 minutes. Each contract runs lint, typecheck, scoped tests, then a 3–5 minute first stet review. `lanes.maxParallel` is 2 so lanes do not queue on LM Studio. If a contract times out, retry the task; stet re-runs after dismissals are incremental.
- SP-828 runs its own Contract with the new script and config from its diff; until it lands, the v1.5.0 contract script on `main` cannot pass after dismissals.
- Stet reviewer false positives (invented syntax errors on new files, stale hunks) are expected on JS/TS diffs; workers must dismiss with tool evidence, not edit code to satisfy them.
- Waves 0 and 1 run on the installed v2.27.0 engine, whose reviewers load user extensions until SP-819 lands. Extension check and reviewer probe done 2026-10-14 (pi-loop removed, 3/3); re-probe if any pi package changes before wave 1.
- LM Studio serves `qwen/qwen3.8-27b` with parallel 1 and a 1 h idle TTL: two lanes' stet reviews queue on one slot, and the first review after an idle hour pays a model reload. Watch contract durations against the 10-minute limit in wave 0 and round 1 of wave 1.
- SP-819 changes every reviewer spawn. If a reviewer needs a built-in pi extension that `-ne` disables, every review breaks. SP-819 Step 0 lists exact-args tests; post-integrate `release:check` and wave 2 reviews are the live check. Wave 2 reviews run the new code only through the checkout CLI (`node bin/spine.mjs`); the global install is a stale copy (2026-10-10), and `npm install` in the repo does not update it.
- SP-821 reverses SP-762's salvage routing. #291's complaint was that retry language forced a worker re-run; SP-821 Step 0 must confirm retry resumes at the review before changing anything.
- SP-823 touches two 498-line batch modules; edits must be net-negative.
- SP-827 changes `readReviewLevel`, which gates every review phase. A wrong `Type` parse would skip reviews on `llm` packets; its tests cover `llm` at levels 0/1/2. `review-artifacts.mjs` is at 497 lines (net ≤ 3).
- SP-826 changes the tail prompt every worker receives. If `includeAgentInclude` defaults wrong, agentSession workers lose `worker.md`; `worker-backend.test.mjs` and `template-drift.test.mjs` are in its Contract.

---

## Publish checklist (Phase 5–6)

- [x] Operator approved scope (set `Operator approved scope: yes` above; 2026-10-14)
- [ ] SP-828 integrated on `main` before release wave 1
- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD`
- [ ] CI green on `HEAD`
- [ ] `git status` clean
- [ ] Operator approved publish bump type: patch
- [ ] `npm version patch` + `git push && git push --tags`
- [ ] `release.yml` succeeded; staged package approved (2FA)
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
- [ ] #334, #315, #335, #336 closed; #314 progress comment (stays open)
- [ ] #342 closed once the skills commit is pushed to `origin/main`
