# Release manifest — v2.14.1

**Created:** 2026-08-19
**Current version:** 2.14.0
**Target version:** v2.14.1
**Bump type:** patch
**Profile:** patch
**Operator approved scope:** yes (2026-08-20)
**Composition choice:** A — Consumer bugfix patch (post-v2.14.0 git-ai batch findings)
**Worker model pin:** `kimi-coding/k3` (thinking: high) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**GitNexus:** refreshed 2026-08-19 — status up-to-date with HEAD

---

## Context

Operator request: next release after v2.14.0; avoid v2.12.x–v2.14.0 release pain points; address consumer bugs filed 2026-08-15/16 from git-ai batch `20260815T223806`.

- Current `main`: `2.14.0` @ HEAD (clean, synced with `origin/main`)
- Pending SP-*: **0** (683 `.DONE`) — all selected work is **gaps**
- Open bugs: **5** (#252–#256); open docs: **0**; open enhancements: deferred
- Next Task ID: **SP-707** (this release consumes SP-707–SP-712)
- Doctor: advisory quota-risk (#251, pin on kimi-coding); stale worktree `spine-20260802T231234`; `--attached` orphan warn (non-TTY)
- Batch state: v2.14.0 batch `20260815T171647` completed; diagnosis `human_base_diverged` (historical — `main` clean now)

**Do not reintroduce (v2.12.1–v2.14.0, still binding):**

1. Start Phase 4 without recorded scope approval (F1/#249)
2. Mid-release edit `.spine/spine-config.json` agent pins (F7/#248)
3. Judge `release:check` from log tails alone — verify exit codes (`PIPESTATUS[0]`)
4. Let `main` drift far ahead of `origin` between waves (F8)
5. Use `--attached` from agent/non-TTY shells (#163)
6. Treat cancelled / missing CI as green or red — **no signal** (F-C); recovery is `workflow_dispatch` + wait
7. Skip post-integrate `release:check` between waves
8. Publish without CI green on `HEAD` (#156)

**v2.14.0 consumer issues driving this patch:**

| Issue | Symptom | Impact |
|-------|---------|--------|
| #253 | worker-runner drops pi stdout/stderr when exit 0 without `.DONE` | Salvage logs useless; retry/debug slow |
| #252 | `spine wait --until failed` never wakes on `worker_done_missing` | Outer-loop agents hang until timeout |
| #254 | gate evidence rejects `cargo` / `task` / `$PATH` prefixes | No real test proof in integrate evidence |
| #255 | lane commit stages `.pi/` and `.pi-smart-router/` | Agent runtime pollution in orch merges |
| #256 | doctor ETIMEDOUT on `pi --list-models` → blocking `pi login` hint | Preflight fails on slow catalog fetch |

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 (v2.14.0 post-mortem) | 1–2 | PASS |
| Bug fixes | 5 (#252–#256) | 3–5 | PASS |
| Enhancements | 0 | **0** | PASS |
| **Total tasks** | 6 | 5–8 | PASS |

**Profile audit:** PASS

---

## GitNexus blast-radius warnings (Phase 2)

| Symbol | Direction | Risk | Implication |
|--------|-----------|------|-------------|
| `diagnosisMatchesUntil` | upstream | LOW (0) | SP-709: extend `reconciliationMatchesUntil` only; keep exact diagnosis match for explicit tokens |
| `assertSafeEvidenceCommand` | upstream | LOW (4 in Batch module) | SP-710: extend allowlist deliberately; keep fail-closed on shell metacharacters except documented env prefixes |
| `DEFAULT_WORKTREE_SETUP_IGNORE_PATHS` | — | LOW | SP-711: additive ignore paths only; mirror SP-640 `.venv` pattern |
| `checkModelProvider` | — | LOW | SP-712: ETIMEDOUT → advisory warn (`ok: true, warning: true`), not hard fail |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-707 | — | doc | S | Post-mortem v2.14.0 (painless ops cycle) | Writes `docs/release/post-mortem-v2.14.0.md` |
| SP-708 | #253 | bug | S | Worker-runner flush pi output on DONE-missing | `bin/spine-worker-runner.mjs` |
| SP-709 | #252 | bug | S | `spine wait --until failed` matches terminal batch failure | `src/cli/spine-wait.mjs` |
| SP-710 | #254 | bug | S | Gate evidence allow cargo/task + safe PATH prefix | `src/batch/evidence-command.mjs` |
| SP-711 | #255 | bug | S | Lane commit ignore `.pi/` and `.pi-smart-router/` | `src/config/spine-config-load.mjs` |
| SP-712 | #256 | bug | S | Doctor ETIMEDOUT on `--list-models` is advisory | `src/doctor/run-doctor-checks.mjs` |

**Release scope ID:** `SP-707,SP-708,SP-709,SP-710,SP-711,SP-712`

**Dependencies:** all none (parallel-safe)

**Suggested waves:**

```text
Wave 0: SP-707, SP-708, SP-709, SP-710   # 4 tasks (release profile cap)
Wave 1: SP-711, SP-712                     # SP-712 after SP-710 (shared run-doctor-checks.mjs)
```

SP-710 and SP-712 both touch `src/doctor/run-doctor-checks.mjs` — do not run in the same wave.

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-707 SP-708 SP-709 SP-710 SP-711 SP-712
spine plan SP-707,SP-708,SP-709,SP-710,SP-711,SP-712
spine run sequence SP-707,SP-708,SP-709,SP-710,SP-711,SP-712 --dry-run
spine batch start SP-707,SP-708,SP-709,SP-710 --wave 0   # detached
# after wave 0 land loop + release:check green:
spine batch start SP-711,SP-712 --wave 1   # detached
```

**Regression gate** (after each integrate):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
git push origin main
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #225, #229–#232 | epic/enh | Matrix job arrays — out of patch |
| #209–#212, #124, #127, #135, #43 | enh | P3 / large — patch profile excludes enhancements |
| SP-696 abort follow-ups | process | Not consumer-blocking |

---

## Risks and blockers

- Worker pin `kimi-coding/k3` — doctor quota-risk advisory (#251); **do not** thrash pins on 429/403
- Six S tasks in two waves — stay within patch profile; no M/L scope creep
- SP-710 evidence allowlist expansion — must stay fail-closed on arbitrary `$` / shell injection
- Stale worktree `spine-20260802T231234` — optional cleanup before batch

---

## Stabilization / do not reintroduce

- No Phase 4 without `Operator approved scope: yes` above
- No mid-release agent pin edits
- Detached batches only from agent shells
- Post-integrate `release:check` exit 0 before next wave / push
- Pre-tag: `ci.yml` green on HEAD; cancelled/absent → `workflow_dispatch`
- Post-publish smoke via `scripts/post-publish-smoke.sh` (F9 registry lag)

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main`
- [x] Post-integrate `release:check` green after **each wave**
- [x] `spine preflight` green
- [x] `npm run release:check` green on final `HEAD` — **verified exit 0** (`80d4f76c`)
- [x] CI workflow green on `HEAD` (`gh run list --workflow ci.yml`) — [32591005678](https://github.com/beettlle/pi-spine/actions/runs/32591005678)
- [x] `git status` clean (at publish)
- [x] Operator approved publish bump type: **patch**
- [x] `npm version patch` + `git push && git push --tags` — tag `v2.14.1` @ `80d4f76c`
- [x] `release.yml` succeeded — [32591899492](https://github.com/beettlle/pi-spine/actions/runs/32591899492)
- [x] Post-publish smoke: `scripts/post-publish-smoke.sh 2.14.1` — OK
