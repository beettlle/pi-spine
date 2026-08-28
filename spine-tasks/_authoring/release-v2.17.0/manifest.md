# Release manifest — v2.17.0

**Created:** 2026-08-28
**Current version:** 2.16.0
**Target version:** v2.17.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-08-28)
**Composition choice:** Pre-landed lint-churn reduction (commit `3df30b4e`) + deferred P2 enhancements **#270** + **#267** (from v2.16.0 defer table). Bug budget **0** with operator override (no open bugs).
**Worker model pin:** `zai/glm-5.3` (activeProfile: `default`) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**GitNexus:** refreshed 2026-08-28 — status up-to-date with HEAD (`37dd536` at analyze; post-commit HEAD `3df30b4e` — re-analyze before Phase 4)

---

## Context

Operator request: **next minor** after v2.16.0 → **v2.17.0**, include uncommitted lint-churn work + tracker issues.

- Current `main`: `2.16.0` + pre-landed `3df30b4e` (ahead of origin by 1)
- Pending SP-*: **0** — selected work is **gaps** (Next Task ID **SP-731**)
- Open issues: **0 bugs**, **0 documentation**, **15 enhancements** (all enh)
- Doctor: advisory quota-risk (#251) on `kimi-coding` / escalate `google` (pins currently `zai/glm-5.3`); stale worktree `spine-20260802T231234`; `--attached` orphan warn (non-TTY)
- Batch state: idle — no active batch

**Operator choices (2026-08-28):**

1. Commit lint-churn as-is → author thin SP packets only for tracker issues
2. Enhancements: **#270 + #267**
3. Bug budget override: **yes** (0 bugs OK)

**Do not reintroduce (v2.12.1–v2.16.0, still binding):**

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
| Documentation | 2 (pre-landed skill/rule/template + post-integrate gate docs in `3df30b4e`) | 2–4 | PASS |
| Bug fixes | 0 | 3–5 | **WARN — operator override** |
| Enhancements | 2 (#270, #267) + pre-landed contract lint-warn guard | 1–2 | **WARN — count lint-warn as process guard / docs tooling; tracker enh = 2** |
| **Total tasks** | ~6–8 (after #267 split; exclude pre-landed) | 10–15 | PASS |

**Profile audit:** PASS with operator override (bug count 0; lint-warn treated as pre-landed authoring hygiene rather than a third tracker enhancement)

---

## Intake table

| Issue # | Labels | Mapped SP-* | Bucket | Profile fit | Notes |
|---------|--------|-------------|--------|-------------|-------|
| — | — | pre-landed `3df30b4e` | doc + tooling | minor ✓ | Contract lint-missing warn + skill/rule sync |
| #270 | enh P2 | SP-731–SP-732 (gaps) | enh | minor ✓ | Fake-async removal — split CLI vs batch |
| #267 | enh P2 | SP-733–SP-736 (gaps, provisional) | enh | minor ✓ | Break engine-lanes allowlisted cycles — split L→S/M |
| #266 | enh P2 | — | — | defer | `@ts-nocheck` burn-down — large |
| #225, #229–#232 | epic/enh | — | — | defer | Matrix job arrays |
| #209–#212, #124, #127, #135, #43 | enh P3 | — | — | defer | Low priority backlog |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| *(pre-landed)* | — | doc/tooling | — | Contract `testCommand` lint-missing warn + operator skill sync | Commit `3df30b4e` — no SP |
| SP-731 | #270 (Partial) | enh | S | Remove fake-async in CLI + config + analyze | `runJournalFollow`, `runSpineSettingsSlash`, `runLaneLogs`, `analyzeTasksScope`, `buildWorkerContextAsync` |
| SP-732 | #270 | enh | S | Remove fake-async in batch merge/queue/review-spawn | `mergeWaveLanesToOrch`, `skipTaskDoneOnDisk`, `spawnReviewerPi`; optional arch lint — **Closes #270** |
| SP-733 | #267 (Partial) | enh | M | Extract leaf diagnosis so reconcile does not import engine-lanes | Shrink allowlist edges through `reconcile` ↔ `engine-lanes` |
| SP-734 | #267 (Partial) | enh | M | Detach post-merge-limbo spawn argv / gate edges from engine-lanes facade | Follow #83 slice C leaf pattern |
| SP-735 | #267 (Partial) | enh | S | Break remaining batch-state-io / meta-reconstruct cycle variants | Allowlist shrink |
| SP-736 | #267 | enh | S | Empty `ALLOWED_CLUSTER_CYCLES` + arch test green | **Closes #267** — depends on SP-733–735 |

**Release scope ID (provisional — finalize after Phase 3 author):** `SP-731,SP-732,SP-733,SP-734,SP-735,SP-736`

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-731 SP-732 SP-733 SP-734 SP-735 SP-736
spine plan SP-731,SP-732,SP-733,SP-734,SP-735,SP-736
spine run sequence SP-731,SP-732,SP-733,SP-734,SP-735,SP-736 --dry-run
spine batch start SP-731,SP-732,SP-733,SP-734,SP-735,SP-736 --wave N   # detached
```

**Regression gate** after each integrate:

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

**Operator gates:**

1. **Approve this manifest** — set `Operator approved scope: yes` below. **Phase 4 HARD STOP** without it
2. `spine gate approve` per integrate wave
3. Publish approval before `npm version minor`

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #270 | enh | SP-731, SP-732 | create-spine-tasks (lean) |
| #267 | enh | SP-733–SP-736 | create-spine-tasks (lean); split on cycle edges |

---

## Wave plan snapshot

```text
Wave 0: SP-731, SP-732 (2 parallel lanes — #270 CLI vs batch)
Wave 1: SP-733 (#267 resume leaf; dep SP-732)
Wave 2: SP-734 (#267 limbo leaf)
Wave 3: SP-735 (#267 state-io leaf)
Wave 4: SP-736 (#267 empty allowlist)
```

Validated 2026-08-28: `spine tasks validate` 6/6 pass; `spine plan` 5 waves.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #266 | enh | `@ts-nocheck` burn-down — multi-wave; defer |
| #225, #229–#232 | epic/enh | Matrix job arrays — out of this minor |
| #209–#212, #124, #127, #135, #43 | enh P3 | Low priority |
| Quota-risk escalate signal automation | ops | Deferred per #248 optional AC |

---

## Risks and blockers

- **#267 allowlist grew** beyond the issue's original 2 cycle strings (11 entries in `tests/arch/import-cycles.test.mjs`) — split may need adjustment during Phase 3 audit; do not ship a single L packet
- **#270 `spawnReviewerPi` / `mergeWaveLanesToOrch`** touch hot batch paths — serialize with #267 waves (do not parallel #270 batch task with #267)
- Doctor quota-risk advisory (#251) — advisory only; keep worker pin `zai/glm-5.3` for the release
- Stale worktree `spine-20260802T231234` — cleanup optional before preflight noise

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] CI workflow green on `HEAD` (`gh run list --workflow ci.yml`)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke via `scripts/post-publish-smoke.sh 2.17.0`
- [ ] Close #270 / #267 after land (§4.3c) — verify CLOSED before final report
