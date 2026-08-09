# Release manifest — v2.13.0

**Created:** 2026-08-09
**Current version:** 2.12.3
**Target version:** v2.13.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-08-09)
**Composition choice:** A — Painless ops (2026-08-09)
**Worker model pin:** `kimi-coding/k3` (thinking: high) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none

---

## Context

Operator request: next release after v2.12.3 pain (mid-release model-pin thrash + matrix planner abort); prefer clean/painless.

- Current `main`: `2.12.3` @ `aee9f607`, dirty only hygiene (`rules-manifest` timestamp + GitNexus `AGENTS.md`/`CLAUDE.md`)
- Pending SP-*: **0** (675 `.DONE`) — all selected work is **gaps**
- Open bugs: **0**; open docs: **0**; open enhancements: 15 (mostly matrix epic children + P3 backlog)
- Filed [#251](https://github.com/beettlle/pi-spine/issues/251) for deferred #248 doctor/preflight AC
- GitNexus: refreshed 2026-08-09 — status up-to-date with HEAD

**Do not reintroduce (v2.12.1–v2.12.3):**

1. Start Phase 4 without recorded scope approval (F1/#249)
2. Mid-release edit `.spine/spine-config.json` agent pins (F7/#248) — v2.12.3 violated this after Kimi 429
3. Re-land planner virtual matrix row IDs / SP-689 shape (F2/#226 superseded by #228)
4. Judge `release:check` from log tails alone — verify exit codes
5. Let `main` drift far ahead of `origin` between waves (F8)
6. Use `--attached` from agent/non-TTY shells (#163)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 (v2.12.3 post-mortem) + embedded docs in #238/#251 packets | 2–4 | WARN (1 standalone; QUICK-REFERENCE + skill docs in enh packets) |
| Bug fixes | 0 | 3–5 | WARN — no open bugs; operator override |
| Enhancements | 2 issues (#251, #238 as 2 S packets) | 1–2 | PASS |
| **Total tasks** | 4 | 10–15 | PASS |

**Profile audit:** PASS with operator override (0 bugs; docs count via embedded paths)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-699 | — | doc | S | Post-mortem v2.12.3 (process / pin thrash / #226 option A) | Folder `SP-699-post-mortem-v2-12-3`; writes `docs/release/post-mortem-v2.12.3.md` |
| SP-700 | #251 | enh | S | Doctor/preflight quota-risk escalate warning | Closes #251; advisory warn; use metrics/quota signals |
| SP-701 | #238 | enh | S | Map anthropic + github-copilot pool IDs | Partial #238; `resolvePoolId` + tests only |
| SP-702 | #238 | enh | S | Optional anthropic/copilot probes + QUICK-REFERENCE | Closes #238; fail-closed adapters; credential docs |

**Release scope ID:** `SP-699,SP-700,SP-701,SP-702`

**Dependencies:**

```text
SP-699 — none
SP-700 — none
SP-701 — none
SP-702 — SP-701   # probes need pool IDs; serialize quota-snapshot/probes hot files
```

**Suggested waves:**

```text
Wave 0: SP-699, SP-700, SP-701   # disjoint file scopes
Wave 1: SP-702                   # after SP-701
```

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-699 SP-700 SP-701 SP-702
spine plan SP-699,SP-700,SP-701,SP-702
spine run sequence SP-699,SP-700,SP-701,SP-702 --dry-run
spine batch start SP-699,SP-700,SP-701,SP-702 --wave N   # detached — omit --attached
```

**Regression gate** (after each integrate):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

Then `git push origin main` when remote publish is the goal (F8).

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| (process docs) | doc | SP-699 | create-spine-tasks (lean) |
| #251 | enh | SP-700 | create-spine-tasks (lean) |
| #238 (pools) | enh | SP-701 | create-spine-tasks (lean) |
| #238 (probes+docs) | enh | SP-702 | create-spine-tasks (lean); dep SP-701 |

---

## Wave plan snapshot

```text
4 task(s) · 2 wave(s) · maxParallel 4

Wave 0 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-699 — Post-mortem v2-12-3 release process
  Lane 2: SP-700 — Doctor/preflight quota-risk escalate warning
  Lane 3: SP-701 — Map anthropic + github-copilot quota pool IDs

Wave 1 · 1 task
  Lane 1: SP-702 — Optional anthropic/copilot probes + QUICK-REFERENCE
```

**Analyze:** 0 blocking (pre-existing CONTEXT `_explore/engine-lanes-split/findings.md` warning).

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #225 | epic | Matrix job arrays — out of painless minor |
| #229–#232 | enh | Matrix epic children — defer (v2.12.3 matrix churn) |
| #209–#213 | enh | P3 backlog — exceed 1–2 enh budget |
| #120, #124, #127, #135, #43 | enh | Large / epic-adjacent |
| #245 V8 attribution root-cause | bug (closed strategy) | Isolation re-verify remains publish gate; full V8 rewrite not in scope |

---

## Risks and blockers

- Worker pin remains `kimi-coding/k3` per operator — elevated fail%/quota risk (F7); **do not** thrash pins mid-release if 429s occur; pause/retry or abort wave instead
- #238 Copilot/Anthropic probes are partial (enterprise/Admin APIs) — fail-closed to `absent`; do not scrape dashboards
- SP-701/SP-702 share `src/metrics/*` — **must serialize**
- SP-700 touches doctor/preflight — keep disjoint from SP-699 docs-only paths
- Stale leftover worktree `spine-20260802T231234` (doctor warn) — cleanup optional before batch
- Dirty hygiene files before packet commit: `.spine/rules-manifest.json`, `AGENTS.md`, `CLAUDE.md` (GitNexus)

---

## Stabilization / do not reintroduce

- No Phase 4 without this manifest’s `Operator approved scope: yes`
- No mid-release `.spine/spine-config.json` agent pin edits
- No planner virtual matrix row IDs
- Detached batches only from agent shells
- Post-integrate `release:check` exit 0 before next wave / push
- Pre-tag: `ci.yml` green on HEAD; post-publish smoke via `scripts/post-publish-smoke.sh`

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (exit 0 verified)
- [ ] CI workflow green on `HEAD` (`gh run list --workflow ci.yml`)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke: `scripts/post-publish-smoke.sh 2.13.0`
