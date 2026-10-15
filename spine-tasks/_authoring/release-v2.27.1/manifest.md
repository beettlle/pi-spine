# Release manifest — v2.27.1

**Created:** 2026-10-10
**Current version:** 2.27.0
**Target version:** v2.27.1
**Bump type:** patch
**Profile:** patch
**Operator approved scope:** yes (2026-10-14, operator) — 10 tasks including SP-828 as release wave 0; **12** after the operator approved wave 0b (SP-829, SP-830) on 2026-10-14 to fix the wave 0 blockers. Do not push to `origin` until the release work is done (operator instruction 2026-10-14).
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
| **Total tasks** | 12 | 5–8 | **PASS with operator override** — operator chose SP-826 + SP-827 (2026-10-10, token-cost audit); both S, disjoint File Scope, run in release wave 2. Operator added SP-828 (2026-10-11) as release wave 0 so the release is stet-reviewed, and SP-829 + SP-830 (2026-10-14) as wave 0b to fix the wave 0 blockers |
| Task sizes | all S | S only | PASS |
| Dep drift check recorded | yes | WARN if missing | PASS |
| No-code tasks at Review Level 0 | SP-825 (docs; `testCommand` `true`) | all no-code tasks | PASS — `isReviewTypeRequired` returns `false` at level 0, so no plan/code/final reviewer spawns. SP-828 changes scripts, config, and tests, so it stays Level 1 |
| S/M packets without coverage gate or full suite | all 12 | all | PASS (#342; packet audit 2026-10-14) |

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
| SP-829 | — (`13ea1975` regression) | bug | S | Hermetic worker-prompt-rules tests | Wave 0b; restores `release:check`; SP-826 depends on it (its Contract runs the file) |
| SP-830 | [#346](https://github.com/beettlle/pi-spine/issues/346) | bug | S | Integrate removes branch-deleted paths from the base checkout | Wave 0b; Closes #346; Review Level 2, stet `default` |

**Release scope ID:** `SP-828,SP-829,SP-830,SP-819,SP-820,SP-821,SP-822,SP-823,SP-824,SP-825,SP-826,SP-827`

**Stet gating (2026-10-11):** each code packet's Contract ends with `bash scripts/spine-stet-contract-run.sh <level>` — `default` for SP-819, SP-820, SP-821, SP-824, SP-827; `lenient` for SP-822, SP-823, SP-826. SP-825 (docs, `testCommand` `true`) has no stet step. All stet-gated packets list `.review/**` in `fileScopeMustNotChange`.

### Operator wave plan (explicit scope per wave)

| Wave | Scope | Rationale |
|------|-------|-----------|
| 0 | `SP-828` | Stet refresh must be on `main` before any stet-gated Contract runs |
| 0b | `SP-829,SP-830` | Wave 0 blockers: `release:check` red from `13ea1975`, and integrate leaving branch deletions staged (#346). Both land before wave 1, so wave 1's integrate runs the fixed sync. 1 round of 2 lanes |
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

# Release wave 0b — wave 0 blockers (SP-829 tests, SP-830 integrate deletions #346)
date -u; sp batch start SP-829 SP-830
sp status --diagnose
sp gate approve && sp integrate && npm install && sp batch complete
git status --short                               # this integrate still runs the pre-SP-830 sync; clear stale deletions by hand
npm run release:check 2>&1 | tee /tmp/pi-spine-v2.27.1-wave0b.log   # must be green before wave 1

# Release wave 1
date -u; sp batch start SP-819 SP-820 SP-823 SP-824
sp status --diagnose
sp gate approve && sp integrate && npm install && sp batch complete
npm run release:check 2>&1 | tee /tmp/pi-spine-v2.27.1-wave1.log
git status --porcelain                           # must be empty (SP-823: tests no longer rewrite .spine/rules-manifest.json; SP-830: no stale deletions after integrate)
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
- **2026-10-14 19:50 UTC wave 0 landed** — SP-828 `.DONE`; `contract.verified` ok; final review PASS after one `review.spawn_retry`. `spine integrate` → `31cd2314`. After integrate, main's index re-staged the deleted gitlink `.review/worktrees/stet-0ca229b1c13e` (HEAD tree was correct); cleared with `git rm --cached`. That is a pi-spine integrate bug, filed as [#346](https://github.com/beettlle/pi-spine/issues/346) (fix: SP-830). Post-integrate `release:check`: exit 1, 2875/2877 pass (`/tmp/pi-spine-v2.27.1-wave0.log`). Failures: `tests/batch/worker-prompt-rules.test.mjs` "buildWorkerTailPrompt includes critical-rules for JS-scoped task" and "buildWorkerContextAsync appends config.standards end-to-end". Cause: `13ea1975` (`.spine/rules-profile.json` neverInclude, read via the real project root). It reproduces outside stet. Wave 1 is on hold for an operator decision. The operator approved wave 0b (SP-829, SP-830) before wave 1.
- **2026-10-14 stet issues** — First release gated by stet; SP-828 Discovery 6 had 3 false positives, all dismissed. Filed [stet#7](https://github.com/beettlle/stet/issues/7) (`stet status` `findings:` counts dismissed findings), [stet#8](https://github.com/beettlle/stet/issues/8) (dismissals lost after `stet finish`; the reason for `SPINE_STET_NO_AUTO_FINISH=1`), [stet#9](https://github.com/beettlle/stet/issues/9) (default `.review/worktrees/` committed as a gitlink). False-positive quality is not filed; file it if the pattern recurs in waves 1–2.
- **2026-10-14 20:06 UTC wave 0b start** — `spine batch start SP-829 SP-830` with `SPINE_STET_NO_AUTO_FINISH=1`. Batch `20261014T200611-ebe3`. Two retries per task before both passed:
  - SP-829: the worker claimed Contract success without running stet. The engine's `contract.verified` re-run raised a false "`fs` not imported" finding (the import is on line 2; JS/TS hunk expansion omits imports). Filed [stet#10](https://github.com/beettlle/stet/issues/10). Dismissed as `false_positive`, then a second finding hit the `.DONE` marker text (`.DONE` matched no `exclude_patterns`). Dismissed and resumed with `STET_EXCLUDE_PATTERNS` = config list + `.DONE` (confirmed in the engine env). Final review PASS.
  - SP-830 (GLM worker): wrote `.DONE` at the lane root twice instead of the task folder. `spine batch retry` re-ran the worker each time; the third run wrote it correctly. Plan and code review APPROVE, `contract.verified` ok, final PASS.
- **2026-10-14 20:58 UTC wave 0b landed** — Gate approved, `spine integrate` → `089a7903` (fast-forward), `git status` clean with no manual index fix (integrate ran pre-SP-830 code; wave 1 is the live #346 check). `batch complete` returned `batch_state_changed_during_terminal_write` because the engine was still running extended gate evidence (full suite) after the early gate approval; `batch.completed` followed at 20:58:28 with no operator action. Post-integrate `release:check`: exit 1, 2 regressions from SP-830 that its Contract did not cover — new `@ts-nocheck` in `src/batch/integrate-path-delete.mjs` (`ts-nocheck-guard`) and `src/batch/integrate-worktree.mjs` at 501 counted lines (`phase23-exit-verify`). Fixed on `main` in `5df55050` (typed module, shared `isTimeoutError`; `integrate-worktree.mjs` 491 lines). `.DONE` added to `.review/config.toml` `exclude_patterns` in `cbb5e791`. Re-run `release:check`: exit 0, 2883/2883 pass, line coverage 90.44% (`/tmp/pi-spine-v2.27.1-wave0b.log`).
- **2026-10-14 21:09 UTC wave 1 start** — `spine batch start SP-819 SP-820 SP-823 SP-824` with `SPINE_STET_NO_AUTO_FINISH=1`. Batch `20261014T210935-9204`, 2 lanes, 2 tasks per lane. SP-819 and SP-823 passed on the first run.
  - SP-820 and SP-824 (GLM workers) each wrote `.DONE` at the lane root. Moved to the task folder; `spine batch retry` resumed at review. SP-820 PASS at 21:54.
  - SP-824 then hit `contract_failed`. It ran second on lane 2, and the lane-commit sanitizer (`git clean -fdX -- .review`) had deleted the stet session and baseline ref left from SP-820. Filed [#349](https://github.com/beettlle/pi-spine/issues/349). Restored the baseline (`48b50791`), ran stet, dismissed 7 findings (false_positive / wrong_suggestion / out_of_scope / already_correct), retried. `contract.verified` ok, final PASS at 22:06.
  - Workaround on `main` (`982ec8ed`): the setup hook also writes the baseline ref under the git dir, and `spine-stet-contract-run.sh <level> <task-id>` reviews from the parent of the task's first lane commit, restarting the session when stet's baseline differs. The wave 2 code packets (SP-821, SP-822, SP-826, SP-827) pass their task ID (operator amendment 2026-10-14).
- **2026-10-14 22:25 UTC wave 1 landed** — The first wave merge (22:06) failed with `merge_blocked`: the engine checks out the orch branch in the main checkout, and uncommitted operator edits to the wave 2 PROMPT.md files blocked `git checkout`. Stashed them, `spine batch resume --force` re-ran only the merge (both lanes merged at 22:19). Gate approved, `spine integrate` → `1b0a522a`, `batch complete` archived. `git status --porcelain` empty after integrate with no manual index fix (live check of SP-830 #346 and SP-823 #315 passed). `rg -- '-ne\b' src/batch/review-spawn.mjs`: SP-819 default at line 134. Post-integrate `release:check`: exit 0, 2914/2914 pass, line coverage 90.59% (`/tmp/pi-spine-v2.27.1-wave1.log`).
- **2026-10-14 22:32 UTC wave 2 start** — `spine batch start SP-821 SP-822 SP-826 SP-827 SP-825` with `SPINE_STET_NO_AUTO_FINISH=1`. Batch `20261014T223221-7ba1`. Both lanes had the worktree and git-dir baseline refs and an open stet session (`982ec8ed` workaround live).
  - SP-821 and SP-822 (GLM) both wrote `.DONE` at the lane root; SP-821 also committed it. Moved into the task folders (`git mv` + commit for SP-821). SP-822 plan review REVISE (invented config key instead of `agents.reviewer.loadUserExtensions`, missing `extensions/` fallback scan).
  - 23:07 UTC: GLM 429 (code 1308) during the SP-822 revision. The quota fallback applied `allegretto` (`kimi-coding/k3`), which returned 403 (5-hour limit) at once. SP-822, SP-826, SP-827 failed `provider_quota_exhausted`; batch failed.
  - 23:12 UTC: `batch retry SP-821` (review-only on Gemini): plan APPROVE, `contract.verified`, final PASS.
  - 01:45 UTC: Kimi reset (probe OK). Retried SP-822, SP-826, SP-827 one at a time (`batch retry` takes one task ID; extra IDs are ignored silently). Workers ran on k3 because the fallback hop is sticky for the batch ([#350](https://github.com/beettlle/pi-spine/issues/350)).
  - SP-822 and SP-827 Contracts failed on stet false positives (`configResult` scope, `loadSpineConfig` return shape, `NaN` review level, TDZ). Each fresh task-scoped session re-raised findings the previous session had dismissed. Verified each against code, lint, and tests; dismissed (false_positive / wrong_suggestion / already_correct); re-ran the stet step in the lane to 0 findings; retried.
  - SP-826 plan reviewer exited 0 with no artifact twice (transient; Gemini probe OK); retried. SP-826 and SP-827 final reviews returned `### Verdict: APPROVE`, rejected as `final_review_invalid_verdict` (3 times in total). The tracked `.spine/agents/reviewer.md` predates the template's final-verdict section and tells reviewers "APPROVE or REVISE", which conflicts with the final request's PASS/REVISE/REPLAN. Retries passed.
  - SP-827's `contract_failed` deleted its `.DONE`, so the retry restarted the worker on k3, which hit Kimi's weekly (7-day) limit at 02:35. The work was complete (STATUS done, stet 0 findings), so the operator restored the tracked `.DONE` and retried: `contract.verified`, final PASS.
  - SP-825 skipped in this batch (`spine batch skip`): GLM had reset (probe OK 02:36) but the sticky hop kept every worker on Kimi. SP-825 runs in a fresh batch on GLM.
- **2026-10-15 02:45 UTC wave 2 (4 of 5) landed** — Gate approved, `spine integrate` → `42fb9c66`, `batch complete` archived. `git status --porcelain` empty with no manual index fix; no root `.DONE` on `main`. Post-integrate `release:check`: exit 0, 2949/2949 pass, line coverage 90.66% (`/tmp/pi-spine-v2.27.1-wave2.log`).
- **2026-10-15 02:52 UTC wave 2b (SP-825) start** — `spine batch start SP-825` (fresh batch `20261015T025227-0f17`, no quota fallback hop, worker on `zai/glm-5.3-flash`). Review Level 0; `.DONE` in the task folder on the first run. Operator read the docs diff before the gate: the worker runner passes `-ne`, `spine settings show` exists, and no links point at the removed "Salvage → complete land loop" anchor.
- **2026-10-15 03:10 UTC wave 2b landed** — Gate approved, `spine integrate` → `846effde`, `batch complete` archived. All 12 release tasks `.DONE` on `main`. `release:check` on final `HEAD`: exit 0, 2949/2949 pass, line coverage 90.67% (`/tmp/pi-spine-v2.27.1-wave2b.log`). `spine preflight` green. Stopped for operator publish approval.
- **2026-10-15 05:20–16:37 UTC published** — Operator approved publish. Pushed `main` (`e3482d03`); CI green. `npm version patch` → `7ca76c60` + tag `v2.27.1`; pushed. `release.yml` staged the package and created the GitHub Release; operator approved stage `b6a9240a-…` with 2FA. `npm view` → `2.27.1` `latest`; `scripts/post-publish-smoke.sh 2.27.1` OK. Closed #315, #346, #342 (#334, #335, #336 auto-closed by the push); progress comment on #314. #349 and #350 stay open as backlog.

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
| `docs/stet-overview.md` still documents `--auto-finish-zero` | docs | SP-828 Discovery 5; outside SP-828 file scope |
| [stet#7](https://github.com/beettlle/stet/issues/7), [stet#8](https://github.com/beettlle/stet/issues/8), [stet#9](https://github.com/beettlle/stet/issues/9), [stet#10](https://github.com/beettlle/stet/issues/10) | upstream bug | Drop `SPINE_STET_NO_AUTO_FINISH=1` once stet#8 ships |
| SP-829 precedence test | test gap | Test covers profile `neverInclude` over `alwaysInclude`, not over `config.standards` as the Mission asked; final reviewer flagged it |
| Contract scope for new `src/` modules | process | SP-830's Contract omitted `ts-nocheck-guard` and `phase23-exit-verify`; packets that add or grow `src/batch/` modules should run both |
| Worker `.DONE` placement / skipped stet | worker reliability | SP-830 (GLM) wrote `.DONE` at the lane root twice; SP-829 claimed Contract success without the stet step; SP-820 and SP-824 repeated the root `.DONE` in wave 1; SP-821 and SP-822 in wave 2 |
| [#349](https://github.com/beettlle/pi-spine/issues/349) | bug | Lane-commit sanitizer deletes the stet session between serialized lane tasks; worked around in `982ec8ed` (git-dir baseline ref, task-scoped contract review) |
| [#350](https://github.com/beettlle/pi-spine/issues/350) | bug | Quota fallback hop is sticky for the batch; no expiry or clear after the primary pool resets |
| Stale `.spine/agents/reviewer.md` | config drift | Tracked copy lacks the template's final-verdict (PASS/REVISE/REPLAN) section and says "APPROVE or REVISE"; 3 final reviews in wave 2 returned APPROVE and failed `final_review_invalid_verdict`. Refresh from `templates/agents/reviewer.md` |
| `spine batch retry` with several IDs | CLI | Only the first task ID is reset; the rest are ignored without an error |
| `contract_failed` deletes `.DONE` | recovery | A Contract that fails only on stet false positives still deletes `.DONE`, so the retry re-runs the worker; the lane commit can also pick up another task's untracked `.DONE` (SP-822's commit carried SP-827's) |
---

## Risks and blockers

- Stet session lifecycle ([stet#8](https://github.com/beettlle/stet/issues/8)): without `SPINE_STET_NO_AUTO_FINISH=1`, the worker's passing Contract calls `stet finish`, then the engine's `contract.verified` re-run (and the next task on the same lane, since the setup hook runs once per lane) starts a fresh review from the lane baseline. That review can resurface dismissed findings, include earlier tasks' diffs, and fail with `contract_failed`. Export it for every start and resume.
- Keep the main checkout clean while a batch runs: the wave merge checks out the orch branch in place, so any uncommitted edit to a file that differs between orch and `main` fails the merge (`merge_blocked`, wave 1). Commit or stash before the wave finishes; recovery is stash, then `spine batch resume --force`.
- Serialized lane tasks lose the stet session to the lane-commit sanitizer ([#349](https://github.com/beettlle/pi-spine/issues/349)). Stet-gated Contracts must pass their task ID to `scripts/spine-stet-contract-run.sh` so the script rebuilds a task-scoped session.
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
- [x] SP-828 integrated on `main` before release wave 1 (`31cd2314`)
- [x] SP-829 and SP-830 integrated on `main` before release wave 1 (`089a7903`; follow-up fix `5df55050`); `release:check` green (`/tmp/pi-spine-v2.27.1-wave0b.log`)
- [x] All release-scoped tasks `.DONE` on `main` (12/12, 2026-10-15 03:10 UTC)
- [x] Wave 1 (SP-819, SP-820, SP-823, SP-824) integrated on `main` (`1b0a522a`); `release:check` green (`/tmp/pi-spine-v2.27.1-wave1.log`)
- [x] Wave 2 SP-821, SP-822, SP-826, SP-827 integrated on `main` (`42fb9c66`); `release:check` green (`/tmp/pi-spine-v2.27.1-wave2.log`)
- [x] SP-825 (docs) integrated on `main` (`846effde`, batch `20261015T025227-0f17` on GLM); `release:check` green (`/tmp/pi-spine-v2.27.1-wave2b.log`)
- [x] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [x] `spine preflight` green (2026-10-15 03:15 UTC)
- [x] `npm run release:check` green on final `HEAD` (`846effde`: 2949/2949, line coverage 90.67%)
- [x] CI green on `HEAD` (`e3482d03`, [run 38686308991](https://github.com/beettlle/pi-spine/actions/runs/38686308991))
- [x] `git status` clean
- [x] Operator approved publish bump type: patch (2026-10-15)
- [x] `npm version patch` + `git push && git push --tags` (`7ca76c60`, tag `v2.27.1`; `preversion` `release:check` 2949/2949, line coverage 90.65%)
- [x] `release.yml` succeeded ([run 38687934667](https://github.com/beettlle/pi-spine/actions/runs/38687934667)); staged package `b6a9240a-b1af-4faa-9919-50b068802789` approved (2FA); `npm view pi-spine version` → `2.27.1` (`latest`)
- [x] Post-publish smoke per `docs/release/npm-publish.md` (`scripts/post-publish-smoke.sh 2.27.1` OK, 2026-10-15 16:37 UTC)
- [x] #334, #335, #336 closed (auto-closed by the push); #315, #346 closed; #314 progress comment (stays open)
- [x] #342 closed (`f39c87d1` on `origin/main`)
